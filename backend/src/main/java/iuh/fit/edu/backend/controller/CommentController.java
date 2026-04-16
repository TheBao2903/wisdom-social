/*
 * @ (#) CommentController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Comment;
import iuh.fit.edu.backend.dto.request.post.CreateCommentRequest;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.service.post.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
 * @description: Controller for Comment operations
 * @author: GitHub Copilot
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
     * Get comments by target (post, story, etc.)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Comment>>> getCommentsByTarget(
            @RequestParam TargetType targetType,
            @RequestParam String targetId) {
        List<Comment> comments = commentService.getCommentsByTarget(targetType, targetId);
        return ResponseEntity.ok(ApiResponse.success(200, "Comments retrieved successfully", comments));
    }

    /**
     * Get replies for a comment
     */
    @GetMapping("/{commentId}/replies")
    public ResponseEntity<ApiResponse<List<Comment>>> getReplies(@PathVariable String commentId) {
        List<Comment> replies = commentService.getRepliesByParentId(commentId);
        return ResponseEntity.ok(ApiResponse.success(200, "Replies retrieved successfully", replies));
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
