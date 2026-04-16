/*
 * @ (#) SavedPostRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.domain.entity.nosql.SavedPost;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavedPostRepository extends MongoRepository<SavedPost, String> {
    List<SavedPost> findByUserIdOrderBySavedAtDesc(String userId);
    Optional<SavedPost> findByUserIdAndTargetId(String userId, String targetId);
}

