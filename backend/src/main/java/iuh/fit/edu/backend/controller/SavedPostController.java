/*
 * @ (#) SavedPostController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.domain.entity.nosql.SavedPost;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.service.post.SavedPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
 * @description: Controller for SavedPost operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/saved-posts")
@RequiredArgsConstructor
public class SavedPostController {

    private final SavedPostService savedPostService;

    /**
     * Toggle save/unsave post
     */
    @PostMapping("/toggle")
    public ResponseEntity<ApiResponse<SavedPost>> toggleSave(
            @RequestParam String userId,
            @RequestParam String postId) {
        
        SavedPost savedPost = savedPostService.toggleSave(userId, postId);
        
        if (savedPost == null) {
            return ResponseEntity.ok(ApiResponse.success(200, "Post unsaved successfully", null));
        }
        
        return ResponseEntity.ok(ApiResponse.success(200, "Post saved successfully", savedPost));
    }

    /**
     * Get all saved posts by user
     */
    @GetMapping("/user")
    public ResponseEntity<ApiResponse<List<SavedPost>>> getSavedPostsByUser(
            @RequestParam String userId) {
        
        List<SavedPost> savedPosts = savedPostService.getSavedPostsByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success(200, "Saved posts retrieved successfully", savedPosts));
    }

    /**
     * Check if post is saved by user
     */
    @GetMapping("/check")
    public ResponseEntity<ApiResponse<Boolean>> checkIfSaved(
            @RequestParam String userId,
            @RequestParam String postId) {
        
        SavedPost savedPost = savedPostService.checkIfSaved(userId, postId);
        boolean isSaved = savedPost != null;
        
        return ResponseEntity.ok(ApiResponse.success(200, "Check saved status completed", isSaved));
    }
}
