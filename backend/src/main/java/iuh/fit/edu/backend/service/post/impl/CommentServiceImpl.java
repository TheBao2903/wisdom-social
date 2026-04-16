/*
 * @ (#) CommentServiceImpl.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.post.impl;

import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Comment;
import iuh.fit.edu.backend.dto.request.post.CreateCommentRequest;
import iuh.fit.edu.backend.repository.nosql.CommentRepository;
import iuh.fit.edu.backend.repository.nosql.PostRepository;
import iuh.fit.edu.backend.service.post.CommentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * @description: Implementation of CommentService
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CommentServiceImpl implements CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;

    @Override
    @Transactional
    public Comment createComment(CreateCommentRequest request, Long userId) {
        log.info("Creating comment for user: {} on target: {}", userId, request.getTargetId());

        // Extract mentions from content
        List<String> mentions = extractMentions(request.getContent());

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
        } else if (request.getTargetType() == TargetType.POST) {
            // If this is a top-level comment on a post, update post stats
            updatePostCommentCount(request.getTargetId(), 1);
        }

        log.info("Comment created successfully with ID: {}", savedComment.getId());
        return savedComment;
    }

    @Override
    public List<Comment> getCommentsByTarget(TargetType targetType, String targetId) {
        log.info("Getting comments for target: {} of type: {}", targetId, targetType);
        return commentRepository.findByTargetTypeAndTargetIdOrderByCreatedAtDesc(targetType, targetId);
    }

    @Override
    public List<Comment> getRepliesByParentId(String parentId) {
        log.info("Getting replies for parent comment: {}", parentId);
        return commentRepository.findByParentIdOrderByCreatedAtAsc(parentId);
    }

    @Override
    @Transactional
    public void deleteComment(String commentId, Long userId) {
        log.info("Deleting comment: {} by user: {}", commentId, userId);

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        if (!comment.getUserId().equals(userId.toString())) {
            throw new RuntimeException("Unauthorized to delete this comment");
        }

        // Update parent's reply count if this is a reply
        if (comment.getParentId() != null) {
            commentRepository.findById(comment.getParentId()).ifPresent(parent -> {
                parent.setReplyCount(Math.max(0, parent.getReplyCount() - 1));
                commentRepository.save(parent);
            });
        } else if (comment.getTargetType() == TargetType.POST) {
            // If this is a top-level comment on a post, update post stats
            updatePostCommentCount(comment.getTargetId(), -1);
        }

        commentRepository.deleteById(commentId);
        log.info("Comment deleted successfully");
    }

    private List<String> extractMentions(String content) {
        List<String> mentions = new ArrayList<>();
        Pattern pattern = Pattern.compile("@(\\w+)");
        Matcher matcher = pattern.matcher(content);
        while (matcher.find()) {
            mentions.add(matcher.group(1));
        }
        return mentions;
    }

    private void updatePostCommentCount(String postId, int delta) {
        postRepository.findById(postId).ifPresent(post -> {
            if (post.getStats() != null) {
                long newCount = Math.max(0L, post.getStats().getCommentCount() + delta);
                post.getStats().setCommentCount(newCount);
                postRepository.save(post);
                log.info("Updated post {} commentCount to: {}", postId, newCount);
            }
        });
    }
}
