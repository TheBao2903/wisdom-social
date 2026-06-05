/*
 * @ (#) SavedPostServiceImpl.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.SavedPost;
import iuh.fit.edu.backend.modules.post.repository.SavedPostRepository;
import iuh.fit.edu.backend.modules.post.service.SavedPostService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/*
 * @description: Service implementation for SavedPost operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SavedPostServiceImpl implements SavedPostService {

    private final SavedPostRepository savedPostRepository;

    @Override
    public SavedPost toggleSave(String userId, String postId) {
        log.info("Toggling save for userId: {}, postId: {}", userId, postId);
        
        Optional<SavedPost> existingSave = savedPostRepository.findByUserIdAndTargetId(userId, postId);
        
        if (existingSave.isPresent()) {
            // Unsave - delete existing saved post
            log.info("Removing saved post");
            savedPostRepository.delete(existingSave.get());
            return null;
        } else {
            // Save - create new saved post
            log.info("Creating new saved post");
            SavedPost savedPost = SavedPost.builder()
                    .userId(userId)
                    .targetType(TargetType.POST)
                    .targetId(postId)
                    .savedAt(Instant.now())
                    .build();
            
            return savedPostRepository.save(savedPost);
        }
    }

    @Override
    public List<SavedPost> getSavedPostsByUserId(String userId) {
        log.info("Getting saved posts for userId: {}", userId);
        return savedPostRepository.findByUserIdOrderBySavedAtDesc(userId);
    }

    @Override
    public SavedPost checkIfSaved(String userId, String postId) {
        log.info("Checking if post saved - userId: {}, postId: {}", userId, postId);
        return savedPostRepository.findByUserIdAndTargetId(userId, postId).orElse(null);
    }
}
