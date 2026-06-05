/*
 * @ (#) ReactionController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.controller;

import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.post.dto.response.ReactionSummaryResponse;
import iuh.fit.edu.backend.modules.post.service.ReactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
 * @description: Controller for Reaction operations
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/reactions")
@RequiredArgsConstructor
public class ReactionController {

    private final ReactionService reactionService;

    /**
     * Toggle reaction - create, update, or remove
     */
    @PostMapping("/toggle")
    public ResponseEntity<ApiResponse<Reaction>> toggleReaction(
            @RequestParam String userId,
            @RequestParam TargetType targetType,
            @RequestParam String targetId,
            @RequestParam ReactionType reactionType) {
        
        Reaction reaction = reactionService.toggleReaction(userId, targetType, targetId, reactionType);
        
        if (reaction == null) {
            return ResponseEntity.ok(ApiResponse.success(200, "Reaction removed successfully", null));
        }
        
        return ResponseEntity.ok(ApiResponse.success(200, "Reaction updated successfully", reaction));
    }

    /**
     * Get all reactions for a target
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Reaction>>> getReactionsByTarget(
            @RequestParam TargetType targetType,
            @RequestParam String targetId) {
        
        List<Reaction> reactions = reactionService.getReactionsByTarget(targetType, targetId);
        return ResponseEntity.ok(ApiResponse.success(200, "Reactions retrieved successfully", reactions));
    }

    /**
     * Get user's reaction for a target
     */
    @GetMapping("/user")
    public ResponseEntity<ApiResponse<Reaction>> getUserReaction(
            @RequestParam String userId,
            @RequestParam TargetType targetType,
            @RequestParam String targetId) {
        
        Reaction reaction = reactionService.getUserReaction(userId, targetType, targetId);
        return ResponseEntity.ok(ApiResponse.success(200, "User reaction retrieved successfully", reaction));
    }

    /**
     * Get reaction summary for a target
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<ReactionSummaryResponse>> getReactionSummary(
            @RequestParam TargetType targetType,
            @RequestParam String targetId,
            @RequestParam(defaultValue = "3") int top) {

        ReactionSummaryResponse summary = reactionService.getReactionSummary(targetType, targetId, top);
        return ResponseEntity.ok(ApiResponse.success(200, "Reaction summary retrieved successfully", summary));
    }
}
