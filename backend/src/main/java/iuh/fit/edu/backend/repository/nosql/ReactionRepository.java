/*
 * @ (#) ReactionRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Reaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReactionRepository extends MongoRepository<Reaction, String> {
    List<Reaction> findByTargetTypeAndTargetId(TargetType targetType, String targetId);
    Optional<Reaction> findByUserIdAndTargetTypeAndTargetId(String userId, TargetType targetType, String targetId);
}

