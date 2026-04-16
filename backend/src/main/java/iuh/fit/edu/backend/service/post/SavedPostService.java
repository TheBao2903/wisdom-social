/*
 * @ (#) SavedPostService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.post;

import iuh.fit.edu.backend.domain.entity.nosql.SavedPost;

import java.util.List;

/*
 * @description: Service interface for SavedPost operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
public interface SavedPostService {
    
    /**
     * Toggle save/unsave post
     * @param userId User ID
     * @param postId Post ID
     * @return SavedPost if saved, null if unsaved
     */
    SavedPost toggleSave(String userId, String postId);
    
    /**
     * Get all saved posts by user
     * @param userId User ID
     * @return List of saved posts
     */
    List<SavedPost> getSavedPostsByUserId(String userId);
    
    /**
     * Check if post is saved by user
     * @param userId User ID
     * @param postId Post ID
     * @return SavedPost if saved, null if not
     */
    SavedPost checkIfSaved(String userId, String postId);
}
