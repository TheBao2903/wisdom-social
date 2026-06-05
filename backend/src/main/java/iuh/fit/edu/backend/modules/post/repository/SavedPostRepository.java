/*
 * @ (#) SavedPostRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.SavedPost;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavedPostRepository extends MongoRepository<SavedPost, String> {
    List<SavedPost> findByUserIdOrderBySavedAtDesc(String userId);
    List<SavedPost> findByUserIdAndTargetType(String userId, TargetType targetType);
    Optional<SavedPost> findByUserIdAndTargetId(String userId, String targetId);
}

