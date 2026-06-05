/*
 * @ (#) CommentController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.controller;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Comment;
import iuh.fit.edu.backend.modules.post.dto.request.CreateCommentRequest;
import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.post.dto.response.CommentResponse;
import iuh.fit.edu.backend.modules.post.dto.response.PaginatedCommentsResponse;
import iuh.fit.edu.backend.modules.post.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/*
 * @description: Controller for Comment operations with tree-based pagination
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    /**
     * Create a new comment
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Comment>> createComment(
            @Valid @RequestBody CreateCommentRequest request,
            @RequestParam Long userId) {
        Comment comment = commentService.createComment(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(201, "Comment created successfully", comment));
    }

    /**
     * Get root comments (cấp 1) of post/target with pagination
     * Sorted: mới → cũ
     * Each comment includes initial replies (first 3)
     */
    @GetMapping("/root")
    public ResponseEntity<ApiResponse<PaginatedCommentsResponse>> getRootComments(
            @RequestParam TargetType targetType,
            @RequestParam String targetId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        PaginatedCommentsResponse response = commentService.getRootComments(targetType, targetId, page, size);
        return ResponseEntity.ok(ApiResponse.success(200, "Root comments retrieved successfully", response));
    }

    /**
     * Get a specific comment with its initial replies
     * Replies sorted: cũ → mới, limit to 3
     */
    @GetMapping("/{commentId}/with-replies")
    public ResponseEntity<ApiResponse<CommentResponse>> getCommentWithReplies(
            @PathVariable String commentId,
            @RequestParam(defaultValue = "3") int replyLimit) {
        
        CommentResponse response = commentService.getCommentWithReplies(commentId, replyLimit);
        return ResponseEntity.ok(ApiResponse.success(200, "Comment with replies retrieved successfully", response));
    }

    /**
     * Get more replies using cursor-based pagination
     * Sorted: cũ → mới
     */
    @GetMapping("/{parentId}/replies")
    public ResponseEntity<ApiResponse<PaginatedCommentsResponse>> getMoreReplies(
            @PathVariable String parentId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "10") int size) {
        
        PaginatedCommentsResponse response = commentService.getMoreReplies(parentId, cursor, size);
        return ResponseEntity.ok(ApiResponse.success(200, "Replies retrieved successfully", response));
    }

    /**
     * Delete a comment
     */
    @DeleteMapping("/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @PathVariable String commentId,
            @RequestParam Long userId) {
        commentService.deleteComment(commentId, userId);
        return ResponseEntity.ok(ApiResponse.success(200, "Comment deleted successfully", null));
    }
}
