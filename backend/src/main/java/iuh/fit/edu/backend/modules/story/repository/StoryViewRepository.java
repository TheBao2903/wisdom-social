/*
 * @ (#) StoryViewRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.repository;

import iuh.fit.edu.backend.modules.story.entity.StoryView;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoryViewRepository extends MongoRepository<StoryView, String> {
    
    // Get all views for a story (sorted by createdAt DESC)
    List<StoryView> findByStoryIdOrderByCreatedAtDesc(String storyId);
    
    // Get views for story with pagination/sorting
    List<StoryView> findByStoryId(String storyId, Sort sort);
    
    // Check if user viewed story (for preventing duplicate) - returns List to handle legacy duplicates gracefully
    List<StoryView> findByStoryIdAndViewerId(String storyId, String viewerId);
    
    // Batch query viewed stories for a user
    List<StoryView> findByViewerIdAndStoryIdIn(String viewerId, List<String> storyIds);
    
    // Count views for story
    long countByStoryId(String storyId);
    
    // Delete views for story (when deleting story)
    long deleteByStoryId(String storyId);
}

