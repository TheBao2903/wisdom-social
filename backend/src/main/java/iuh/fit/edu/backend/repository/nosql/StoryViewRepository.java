/*
 * @ (#) StoryViewRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.domain.entity.nosql.StoryView;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StoryViewRepository extends MongoRepository<StoryView, String> {
    
    // Get all views for a story (sorted by createdAt DESC)
    List<StoryView> findByStoryIdOrderByCreatedAtDesc(String storyId);
    
    // Get views for story with pagination/sorting
    List<StoryView> findByStoryId(String storyId, Sort sort);
    
    // Check if user viewed story (for preventing duplicate)
    Optional<StoryView> findByStoryIdAndViewerId(String storyId, String viewerId);
    
    // Count views for story
    long countByStoryId(String storyId);
    
    // Delete views for story (when deleting story)
    long deleteByStoryId(String storyId);
}

