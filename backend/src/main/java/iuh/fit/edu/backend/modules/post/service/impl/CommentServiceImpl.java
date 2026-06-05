package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Comment;
import iuh.fit.edu.backend.modules.post.dto.request.CreateCommentRequest;
import iuh.fit.edu.backend.modules.post.dto.response.CommentResponse;
import iuh.fit.edu.backend.modules.post.dto.response.PaginatedCommentsResponse;
import iuh.fit.edu.backend.modules.post.repository.CommentRepository;
import iuh.fit.edu.backend.modules.post.repository.PostRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.post.service.CommentService;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import iuh.fit.edu.backend.modules.post.event.payload.CommentEvent;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.post.event.payload.PostEvent;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.user.service.FriendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/*
 * @description: Implementation of CommentService with tree-based pagination
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CommentServiceImpl implements CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final FriendService friendService;
    private static final int INITIAL_REPLY_LIMIT = 3;

    @Override
    @Transactional
    public Comment createComment(CreateCommentRequest request, Long userId) {
        log.info("Creating comment for user: {} on target: {}", userId, request.getTargetId());

        // 🔒 Validate allowComments for POST comments
        if (request.getTargetType() == TargetType.POST && request.getParentId() == null) {
            postRepository.findById(request.getTargetId()).ifPresent(post -> {
                if (!post.isAllowComments()) {
                    log.warn("Comment creation rejected: Post {} has comments disabled", request.getTargetId());
                    throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Comments are disabled for this post"
                    );
                }
            });
        }

        // Process structured mentions
        List<Comment.Mention> mentions = processMentions(request);

        Comment comment = Comment.builder()
                .userId(userId.toString())
                .targetType(request.getTargetType())
                .targetId(request.getTargetId())
                .parentId(request.getParentId())
                .content(request.getContent())
                .mentions(mentions)
                .reactCount(0L)
                .replyCount(0L)
                .status(StatusType.ACTIVE)
                .isEdited(false)
                .isPinned(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        Comment savedComment = commentRepository.save(comment);

        // If this is a reply, update parent's reply count
        if (request.getParentId() != null) {
            commentRepository.findById(request.getParentId()).ifPresent(parent -> {
                parent.setReplyCount(parent.getReplyCount() + 1);
                commentRepository.save(parent);
            });

            // Replies also contribute to total post comment count.
            if (request.getTargetType() == TargetType.POST) {
                boolean isFriend = isUserFriendOfPostAuthor(userId.toString(), request.getTargetId());
                updatePostCommentCount(request.getTargetId(), 1, true, isFriend);
            }
        } else if (request.getTargetType() == TargetType.POST) {
            // Top-level comment on post
            boolean isFriend = isUserFriendOfPostAuthor(userId.toString(), request.getTargetId());
            updatePostCommentCount(request.getTargetId(), 1, false, isFriend);
            publishActivityBump(request.getTargetId(), Instant.now(), userId.toString());
        }

        // Trigger Notifications
        try {
            if (request.getParentId() != null) {
                // REPLY_COMMENT notification
                commentRepository.findById(request.getParentId()).ifPresent(parent -> {
                    if (!parent.getUserId().equals(userId.toString())) {
                        notificationService.createNotification(NotificationEvent.builder()
                                .recipientId(parent.getUserId())
                                .actorIds(List.of(userId.toString()))
                                .type(NotificationType.REPLY_COMMENT)
                                .targetType(TargetType.COMMENT)
                                .targetId(savedComment.getId())
                                .rootTargetId(request.getTargetId()) // TargetId of the request is the Post ID
                                .content("đã phản hồi bình luận của bạn: " + savedComment.getContent())
                                .build());
                    }
                });
            } else if (request.getTargetType() == TargetType.POST) {
                // COMMENT_POST notification
                postRepository.findById(request.getTargetId()).ifPresent(post -> {
                    if (!post.getAuthorId().equals(userId.toString())) {
                        notificationService.createNotification(NotificationEvent.builder()
                                .recipientId(post.getAuthorId())
                                .actorIds(List.of(userId.toString()))
                                .type(NotificationType.COMMENT_POST)
                                .targetType(TargetType.POST)
                                .targetId(post.getId())
                                .rootTargetId(post.getId())
                                .content("đã bình luận về bài viết của bạn: " + savedComment.getContent())
                                .build());
                    }
                });
            }
            
            // MENTION_IN_COMMENT notifications
            if (mentions != null && !mentions.isEmpty()) {
                for (Comment.Mention mention : mentions) {
                    if (!mention.getUserId().equals(userId.toString())) {
                        notificationService.createNotification(NotificationEvent.builder()
                                .recipientId(mention.getUserId())
                                .actorIds(List.of(userId.toString()))
                                .type(NotificationType.COMMENT_MENTION)
                                .targetType(TargetType.COMMENT)
                                .targetId(savedComment.getId())
                                .rootTargetId(request.getTargetId())
                                .content("đã nhắc đến bạn trong một bình luận: " + savedComment.getContent())
                                .build());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to send notification for comment", e);
        }

        // Publish realtime event to WebSockets - Post-commit
        try {
            CommentResponse responsePayload = commentToResponse(savedComment);
            String rootPostId = getRootPostId(savedComment);
            
            if (rootPostId != null) {
                CommentEvent event = new CommentEvent("CREATE", rootPostId, responsePayload);
                if (TransactionSynchronizationManager.isActualTransactionActive()) {
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            eventPublisher.publishEvent(event);
                        }
                    });
                } else {
                    eventPublisher.publishEvent(event);
                }
            } else {
                log.warn("Could not determine root postId for comment: {}", savedComment.getId());
            }
        } catch (Exception e) {
            log.error("Failed to publish CommentRealtimeEvent", e);
        }

        log.info("Comment created successfully with ID: {}", savedComment.getId());
        return savedComment;
    }


    private String getRootPostId(Comment comment) {
        if (comment.getTargetType() == TargetType.POST) {
            return comment.getTargetId();
        }
        
        // If it's a reply, trace up to root
        int depth = 0;
        String currentParentId = comment.getParentId();
        
        while (currentParentId != null && depth < 10) { // Limit depth to prevent infinite loops
            Comment parent = commentRepository.findById(currentParentId).orElse(null);
            if (parent == null) break;
            
            if (parent.getTargetType() == TargetType.POST) {
                return parent.getTargetId();
            }
            currentParentId = parent.getParentId();
            depth++;
        }
        return null;
    }

    @Override
    public PaginatedCommentsResponse getRootComments(TargetType targetType, String targetId, int page, int size) {
        log.info("Getting root comments for target: {} of type: {} (page: {}, size: {})", 
                 targetId, targetType, page, size);
        
        Pageable pageable = PageRequest.of(page, size);
        
        // Get root comments only (parentId is null) - sorted mới → cũ
        List<Comment> rootComments = commentRepository
                .findByTargetTypeAndTargetIdAndParentIdIsNullOrderByCreatedAtDesc(targetType, targetId, pageable);
        
        // Root count: only for root pagination/hasMore
        long rootCount = commentRepository
                .countByTargetTypeAndTargetIdAndParentIdIsNull(targetType, targetId);

        // Total count: all comments across all levels (for display counters)
        long totalCount = commentRepository
            .countByTargetTypeAndTargetId(targetType, targetId);
        
        // Convert to response and add initial replies for each
        List<CommentResponse> responses = new ArrayList<>();
        for (Comment comment : rootComments) {
            CommentResponse response = buildCommentWithReplies(comment, INITIAL_REPLY_LIMIT);
            responses.add(response);
        }
        
        // Check if there are more pages
        boolean hasMore = (long) (page + 1) * size < rootCount;
        String nextCursor = hasMore ? encodePageCursor(page + 1, size) : null;
        
        return PaginatedCommentsResponse.builder()
                .data(responses)
                .hasMore(hasMore)
                .nextCursor(nextCursor)
                .totalCount((int) totalCount)
                .build();
    }

    @Override
    public CommentResponse getCommentWithReplies(String commentId, int initialReplyLimit) {
        log.info("Getting comment: {} with initial replies (limit: {})", commentId, initialReplyLimit);
        
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));
        
        return buildCommentWithReplies(comment, initialReplyLimit);
    }

    @Override
    public PaginatedCommentsResponse getMoreReplies(String parentId, String cursor, int size) {
        log.info("Getting more replies for parent: {} with cursor: {} (size: {})", parentId, cursor, size);

        Pageable pageable = PageRequest.of(0, size + 1); // +1 to determine hasMore
        List<Comment> replies;

        if (cursor == null || cursor.isBlank()) {
            // First load-more call: get latest replies first
            replies = commentRepository.findByParentIdOrderByCreatedAtDesc(parentId, pageable);
        } else {
            // Next pages: get older replies than cursor timestamp
            Instant cursorInstant = decodeCursor(cursor);
            replies = commentRepository.findRepliesBeforeCursor(parentId, cursorInstant, pageable);
        }
        
        // Total count
        long totalCount = commentRepository.countByParentId(parentId);
        
        boolean hasMore = replies.size() > size;
        if (hasMore) {
            replies = replies.subList(0, size);
        }

        List<CommentResponse> responses = replies.stream()
            .map(this::commentToResponse)
            .collect(Collectors.toList());
        
        String nextCursor = hasMore && !replies.isEmpty()
            ? encodeCursor(replies.get(replies.size() - 1).getCreatedAt())
                : null;
        
        return PaginatedCommentsResponse.builder()
                .data(responses)
                .hasMore(hasMore)
                .nextCursor(nextCursor)
                .totalCount((int) totalCount)
                .build();
    }

    /**
     * Build comment response with initial replies
     */
    private CommentResponse buildCommentWithReplies(Comment comment, int replyLimit) {
        CommentResponse response = commentToResponse(comment);

        // Get initial latest replies (newest-first window)
        Pageable pageable = PageRequest.of(0, replyLimit + 1); // +1 to check if there's more
        List<Comment> replies = commentRepository.findByParentIdOrderByCreatedAtDesc(comment.getId(), pageable);
        
        boolean hasMoreReplies = replies.size() > replyLimit;
        if (hasMoreReplies) {
            replies = replies.subList(0, replyLimit);
        }
        
        List<CommentResponse> replyResponses = replies.stream()
                .map(this::commentToResponse)
                .collect(Collectors.toList());

        // Keep UI list stable: oldest -> newest inside currently loaded window.
        Collections.reverse(replyResponses);
        
        response.setReplies(replyResponses);
        response.setHasMoreReplies(hasMoreReplies);
        
        if (!replies.isEmpty()) {
            // Cursor points to oldest loaded reply in this window.
            response.setNextCursor(encodeCursor(replies.get(replies.size() - 1).getCreatedAt()));
        }
        
        return response;
    }

    /**
     * Convert Comment entity to CommentResponse
     */
    private CommentResponse commentToResponse(Comment comment) {
        return CommentResponse.builder()
                .id(comment.getId())
                .userId(comment.getUserId())
                .targetType(comment.getTargetType())
                .targetId(comment.getTargetId())
                .parentId(comment.getParentId())
                .content(comment.getContent())
                .mentions(comment.getMentions() != null 
                    ? comment.getMentions().stream()
                        .map(m -> new CommentResponse.MentionResponse(m.getUserId(), m.getUsername()))
                        .collect(Collectors.toList())
                    : Collections.emptyList())
                .reactCount(comment.getReactCount())
                .replyCount(comment.getReplyCount())
                .status(comment.getStatus())
                .isEdited(comment.isEdited())
                .isPinned(comment.isPinned())
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .replies(null) // Replies will be set separately
                .hasMoreReplies(false)
                .nextCursor(null)
                .build();
    }

    /**
     * Encode timestamp to cursor for pagination
     */
    private String encodeCursor(Instant timestamp) {
        return Base64.getEncoder().encodeToString(timestamp.toString().getBytes());
    }

    /**
     * Encode page number and size to cursor
     */
    private String encodePageCursor(int page, int size) {
        String cursor = page + ":" + size;
        return Base64.getEncoder().encodeToString(cursor.getBytes());
    }

    /**
     * Decode cursor back to timestamp
     */
    private Instant decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            throw new IllegalArgumentException("Cursor must not be null/blank");
        }
        try {
            String decoded = new String(Base64.getDecoder().decode(cursor));
            return Instant.parse(decoded);
        } catch (Exception e) {
            log.warn("Failed to decode cursor: {}", cursor);
            return Instant.now().minusSeconds(86400); // Default: 1 day ago
        }
    }

    // Legacy methods (keep for backward compatibility)
    
    @Override
    @Transactional
    public void deleteComment(String commentId, Long userId) {
        log.info("Deleting comment: {} by user: {}", commentId, userId);

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getUserId().equals(userId.toString())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized to delete this comment");
        }
        
        String rootPostId = getRootPostId(comment);
        String parentId = comment.getParentId();

        List<String> descendantIds = collectDescendantIds(commentId);
        List<String> allIdsToDelete = new ArrayList<>();
        allIdsToDelete.add(commentId);
        allIdsToDelete.addAll(descendantIds);

        // Update parent's reply count if this is a reply
        if (comment.getParentId() != null) {
            commentRepository.findById(comment.getParentId()).ifPresent(parent -> {
                parent.setReplyCount(Math.max(0, parent.getReplyCount() - 1));
                commentRepository.save(parent);
            });
        }

        // Keep post commentCount synced for all levels (comment + descendants)
        if (comment.getTargetType() == TargetType.POST) {
            // We just decrement the total commentCount for simplicity in deletion,
            // distinguishing between replies and top-level would require more complex checking
            boolean isFriend = isUserFriendOfPostAuthor(userId.toString(), comment.getTargetId());
            boolean isReply = comment.getParentId() != null;
            updatePostCommentCount(comment.getTargetId(), -allIdsToDelete.size(), isReply, isFriend);
        }

        commentRepository.deleteAllById(allIdsToDelete);
        log.info("Comment deleted successfully. Removed {} docs (including descendants)", allIdsToDelete.size());
        
        // Publish realtime DELETE event - Post-commit
        try {
            if (rootPostId != null) {
                CommentResponse deletePayload = CommentResponse.builder()
                        .id(commentId)
                        .parentId(parentId)
                        .build();
                CommentEvent event = new CommentEvent("DELETE", rootPostId, deletePayload);
                
                if (TransactionSynchronizationManager.isActualTransactionActive()) {
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            eventPublisher.publishEvent(event);
                        }
                    });
                } else {
                    eventPublisher.publishEvent(event);
                }
            }
        } catch (Exception e) {
            log.error("Failed to publish delete event", e);
        }
    }

    private void publishActivityBump(String postId, Instant lastActivityAt, String userId) {
        try {
            // 🔒 Only bump post if the user is NOT the post author
            // (Don't push user's own posts to their own feed)
            postRepository.findById(postId).ifPresent(post -> {
                if (post.getAuthorId() != null && post.getAuthorId().equals(userId)) {
                    log.info("⏭️ Skipping BUMP for post: {} - User {} is the post owner", postId, userId);
                    return;
                }

                PostEvent bumpEvent = PostEvent.builder()
                        .action("BUMP")
                        .actorId(userId)          // Who performed the comment
                        .postId(postId)
                        .lastActivityAt(lastActivityAt)
                        .authorId(post.getAuthorId())
                        .build();

                if (TransactionSynchronizationManager.isActualTransactionActive()) {
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            eventPublisher.publishEvent(bumpEvent);
                        }
                    });
                } else {
                    eventPublisher.publishEvent(bumpEvent);
                }
            });
        } catch (Exception e) {
            log.error("Failed to publish PostRealtimeEvent BUMP", e);
        }
    }

    private List<String> collectDescendantIds(String rootCommentId) {
        List<String> descendants = new ArrayList<>();
        Deque<String> queue = new ArrayDeque<>();
        queue.add(rootCommentId);

        while (!queue.isEmpty()) {
            String current = queue.poll();
            List<Comment> children = commentRepository.findByParentIdOrderByCreatedAtAsc(current);
            for (Comment child : children) {
                descendants.add(child.getId());
                queue.add(child.getId());
            }
        }

        return descendants;
    }

    private List<Comment.Mention> processMentions(CreateCommentRequest request) {
        List<Comment.Mention> mentions = new ArrayList<>();
        
        // 1. If FE provided structured mentions, use them
        if (request.getMentions() != null && !request.getMentions().isEmpty()) {
            for (var mReq : request.getMentions()) {
                if (mReq.getUserId() != null && !mReq.getUserId().isBlank()) {
                    mentions.add(new Comment.Mention(mReq.getUserId(), mReq.getUsername()));
                } else if (mReq.getUsername() != null && !mReq.getUsername().isBlank()) {
                    // Fallback to lookup if userId missing
                    userRepository.findByUsername(mReq.getUsername()).ifPresent(u -> 
                        mentions.add(new Comment.Mention(u.getId().toString(), u.getUsername()))
                    );
                }
            }
        } else {
            // 2. Fallback to regex extraction if not provided
            List<String> usernames = extractMentions(request.getContent());
            for (String username : usernames) {
                userRepository.findByUsername(username).ifPresent(u -> 
                    mentions.add(new Comment.Mention(u.getId().toString(), u.getUsername()))
                );
            }
        }
        
        // Deduplicate by userId
        return mentions.stream()
                .collect(Collectors.toMap(
                    Comment.Mention::getUserId, 
                    m -> m, 
                    (existing, replacement) -> existing
                ))
                .values()
                .stream()
                .collect(Collectors.toList());
    }

    private List<String> extractMentions(String content) {
        if (content == null) return Collections.emptyList();
        List<String> mentions = new ArrayList<>();
        Pattern pattern = Pattern.compile("@(\\w+)");
        Matcher matcher = pattern.matcher(content);
        while (matcher.find()) {
            mentions.add(matcher.group(1));
        }
        return mentions;
    }

    private boolean isUserFriendOfPostAuthor(String userId, String postId) {
        return postRepository.findById(postId).map(post -> {
            if (post.getAuthorId() == null || post.getAuthorId().isBlank()) return false;
            if (post.getAuthorId().equals(userId)) return false; // Self is not considered 'friend' for boost
            try {
                return friendService.getAcceptedFriendIds(Long.parseLong(userId))
                        .contains(Long.parseLong(post.getAuthorId()));
            } catch (Exception e) {
                return false;
            }
        }).orElse(false);
    }

    private void updatePostCommentCount(String postId, int delta, boolean isReply, boolean isFriend) {
        postRepository.findById(postId).ifPresent(post -> {
            if (post.getStats() != null) {
                if (isReply) {
                    long newReplyCount = Math.max(0L, post.getStats().getReplyCount() + delta);
                    post.getStats().setReplyCount(newReplyCount);
                } else {
                    long newCount = Math.max(0L, post.getStats().getCommentCount() + delta);
                    post.getStats().setCommentCount(newCount);
                }
                
                if (isFriend) {
                    long newFriendCount = Math.max(0L, post.getStats().getFriendCommentCount() + delta);
                    post.getStats().setFriendCommentCount(newFriendCount);
                }
                
                post.recalculateRankingTime();
                post.setLastActivityAt(Instant.now()); // for UI and realtime
                postRepository.save(post);
                log.info("Updated post {} stats and bumped rankingTime to {}", postId, post.getRankingTime());
            }
        });
    }

    private void updatePostLastActivityAt(String postId) {
        postRepository.updateLastActivityAt(postId, Instant.now());
        log.info("Bumped lastActivityAt for post: {}", postId);
    }
}
