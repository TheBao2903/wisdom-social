/*
 * @ (#) ReactionRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReactionRepository extends MongoRepository<Reaction, String> {
    List<Reaction> findByTargetTypeAndTargetId(TargetType targetType, String targetId);
    List<Reaction> findByUserIdAndTargetType(String userId, TargetType targetType);
    Optional<Reaction> findByUserIdAndTargetTypeAndTargetId(String userId, TargetType targetType, String targetId);
}

