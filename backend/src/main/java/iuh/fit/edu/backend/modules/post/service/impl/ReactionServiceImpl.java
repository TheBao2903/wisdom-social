/*
 * @ (#) ReactionServiceImpl.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Comment;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import iuh.fit.edu.backend.modules.post.dto.response.ReactionSummaryResponse;
import iuh.fit.edu.backend.modules.post.repository.ReactionRepository;
import iuh.fit.edu.backend.modules.post.service.ReactionService;
import iuh.fit.edu.backend.modules.post.repository.PostRepository;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.post.event.payload.PostEvent;
import iuh.fit.edu.backend.modules.post.event.payload.ReactionEvent;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.post.repository.CommentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/*
 * @description: Service implementation for Reaction operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReactionServiceImpl implements ReactionService {

    private final ReactionRepository reactionRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public Reaction toggleReaction(String userId, TargetType targetType, String targetId, ReactionType reactionType) {
        log.info("Toggle reaction: userId={}, targetType={}, targetId={}, reactionType={}", 
                userId, targetType, targetId, reactionType);

        Optional<Reaction> existingReaction = reactionRepository
                .findByUserIdAndTargetTypeAndTargetId(userId, targetType, targetId);

        if (existingReaction.isPresent()) {
            Reaction reaction = existingReaction.get();
            
            // If same type, remove reaction (unlike)
            if (reaction.getType() == reactionType) {
                reactionRepository.delete(reaction);
                log.info("Removed reaction: {}", reaction.getId());
                
                // Update post stats if target is POST
                if (targetType == TargetType.POST) {
                    updatePostReactCount(targetId, -1);
                }
                
                publishRealtimeReaction("UNREACT", targetType, targetId, reaction.getType(), userId);
                
                return null;
            }
            
            // If different type, update reaction
            reaction.setType(reactionType);
            reaction.setUpdatedAt(Instant.now());
            Reaction updated = reactionRepository.save(reaction);
            log.info("Updated reaction: {}", updated.getId());
            
            publishRealtimeReaction("REACT", targetType, targetId, reactionType, userId);
            
            if (targetType == TargetType.POST) {
                updatePostLastActivityAt(targetId);
            }
            
            return updated;
        }

        // Create new reaction
        Reaction newReaction = new Reaction();
        newReaction.setUserId(userId);
        newReaction.setTargetType(targetType);
        newReaction.setTargetId(targetId);
        newReaction.setType(reactionType);
        newReaction.setCreatedAt(Instant.now());
        newReaction.setUpdatedAt(Instant.now());

        Reaction saved = reactionRepository.save(newReaction);
        log.info("Created new reaction: {}", saved.getId());
        
        // Update post stats if target is POST
        if (targetType == TargetType.POST) {
            updatePostReactCount(targetId, 1);
        }

        // Trigger Notification
        try {
            if (targetType == TargetType.POST) {
                postRepository.findById(targetId).ifPresent(post -> {
                    log.info("Reaction on POST {}. Author: {}, Current User: {}", targetId, post.getAuthorId(), userId);
                    if (post.getAuthorId() != null && !post.getAuthorId().equals(userId)) {
                        log.info("Sending REACTION_POST notification to user: {}", post.getAuthorId());
                        notificationService.createNotification(NotificationEvent.builder()
                                .recipientId(post.getAuthorId())
                                .actorIds(List.of(userId))
                                .type(NotificationType.REACTION_POST)
                                .targetType(TargetType.POST)
                                .targetId(post.getId())
                                .rootTargetId(post.getId())
                                .content("đã thích bài viết của bạn")
                                .build());
                    } else {
                        log.info("Skipping notification: user reacted to own post or authorId is null");
                    }
                });
            } else if (targetType == TargetType.COMMENT) {
                commentRepository.findById(targetId).ifPresent(comment -> {
                    log.info("Reaction on COMMENT {}. User: {}, Current User: {}", targetId, comment.getUserId(), userId);
                    if (comment.getUserId() != null && !comment.getUserId().equals(userId)) {
                        log.info("Sending REACTION_COMMENT notification to user: {}", comment.getUserId());
                        notificationService.createNotification(NotificationEvent.builder()
                                .recipientId(comment.getUserId())
                                .actorIds(List.of(userId))
                                .type(NotificationType.REACTION_COMMENT)
                                .targetType(TargetType.COMMENT)
                                .targetId(comment.getId())
                                .rootTargetId(getRootPostId(TargetType.COMMENT, comment.getId()))
                                .content("đã thích bình luận của bạn")
                                .build());
                    } else {
                        log.info("Skipping notification: user reacted to own comment or userId is null");
                    }
                });
            }
        } catch (Exception e) {
            log.error("Failed to send notification for reaction", e);
        }
        
        if (targetType == TargetType.POST) {
            updatePostLastActivityAt(targetId);
            publishActivityBump(targetId, Instant.now(), userId);
        } else if (targetType == TargetType.COMMENT) {
            String rootPostId = getRootPostId(targetType, targetId);
            if (rootPostId != null) {
                updatePostLastActivityAt(rootPostId);
                publishActivityBump(rootPostId, Instant.now(), userId);
            }
        }

        publishRealtimeReaction("REACT", targetType, targetId, reactionType, userId);
        
        return saved;
    }

    private void publishRealtimeReaction(String action, TargetType targetType, String targetId, ReactionType reactionType, String userId) {
        try {
            String rootPostId = getRootPostId(targetType, targetId);
            if (rootPostId != null) {
                ReactionEvent event = ReactionEvent.builder()
                        .action(action)
                        .rootPostId(rootPostId)
                        .targetType(targetType)
                        .targetId(targetId)
                        .reactionType(reactionType)
                        .userId(userId)
                        .build();
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
            log.error("Failed to publish ReactionRealtimeEvent", e);
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
                        .actorId(userId)          // Who performed the reaction
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

    private String getRootPostId(TargetType targetType, String targetId) {
        if (targetType == TargetType.POST) {
            return targetId;
        }
        
        int depth = 0;
        String currentParentId = targetId;
        
        while (currentParentId != null && depth < 10) {
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

    private void updatePostReactCount(String postId, int delta) {
        postRepository.findById(postId).ifPresent(post -> {
            if (post.getStats() != null) {
                long newCount = Math.max(0L, post.getStats().getReactCount() + delta);
                post.getStats().setReactCount(newCount);
                post.recalculateRankingTime();
                post.setLastActivityAt(Instant.now());
                postRepository.save(post);
                log.info("Updated post {} reactCount to: {} and recalculated ranking time", postId, newCount);
            }
        });
    }

    private void updatePostLastActivityAt(String postId) {
        postRepository.updateLastActivityAt(postId, Instant.now());
        log.info("Bumped lastActivityAt for post: {}", postId);
    }

    @Override
    public List<Reaction> getReactionsByTarget(TargetType targetType, String targetId) {
        log.info("Get reactions for target: targetType={}, targetId={}", targetType, targetId);
        return reactionRepository.findByTargetTypeAndTargetId(targetType, targetId);
    }

    @Override
    public Reaction getUserReaction(String userId, TargetType targetType, String targetId) {
        log.info("Get user reaction: userId={}, targetType={}, targetId={}", userId, targetType, targetId);
        return reactionRepository.findByUserIdAndTargetTypeAndTargetId(userId, targetType, targetId)
                .orElse(null);
    }

    @Override
    public ReactionSummaryResponse getReactionSummary(TargetType targetType, String targetId, int topLimit) {
        log.info("Get reaction summary: targetType={}, targetId={}, topLimit={}", targetType, targetId, topLimit);

        List<Reaction> reactions = reactionRepository.findByTargetTypeAndTargetId(targetType, targetId);
        long totalCount = reactions.size();

        if (totalCount == 0) {
            return ReactionSummaryResponse.builder()
                    .totalCount(0)
                    .topReactions(List.of())
                    .build();
        }

        Map<ReactionType, Long> counts = new EnumMap<>(ReactionType.class);
        for (Reaction reaction : reactions) {
            counts.merge(reaction.getType(), 1L, Long::sum);
        }

        int safeTopLimit = Math.max(1, topLimit);

        List<ReactionSummaryResponse.ReactionCountItem> topReactions = counts.entrySet().stream()
                .sorted((a, b) -> {
                    int byCount = Long.compare(b.getValue(), a.getValue());
                    if (byCount != 0) {
                        return byCount;
                    }
                    return Integer.compare(
                            getReactionPriority(a.getKey()),
                            getReactionPriority(b.getKey())
                    );
                })
                .limit(safeTopLimit)
                .map(entry -> ReactionSummaryResponse.ReactionCountItem.builder()
                        .type(entry.getKey())
                        .count(entry.getValue())
                        .build())
                .collect(Collectors.toList());

        return ReactionSummaryResponse.builder()
                .totalCount(totalCount)
                .topReactions(topReactions)
                .build();
    }

    private int getReactionPriority(ReactionType type) {
        return switch (type) {
            case LOVE -> 1;
            case LIKE -> 2;
            case HAHA -> 3;
            case WOW -> 4;
            case SAD -> 5;
            case ANGRY -> 6;
        };
    }
}
