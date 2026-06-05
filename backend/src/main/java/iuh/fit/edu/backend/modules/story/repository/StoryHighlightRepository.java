/*
 * @ (#) StoryHighlightRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.repository;

import iuh.fit.edu.backend.modules.story.entity.StoryHighlight;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoryHighlightRepository extends MongoRepository<StoryHighlight, String> {
    List<StoryHighlight> findByUserId(String userId);

    List<StoryHighlight> findByUserIdOrderByDisplayOrderAsc(String userId);

    void deleteByIdAndUserId(String id, String userId);

    long countByUserId(String userId);
}

