/*
 * @ (#) CommentRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Comment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/*
 * @description: Repository for Comment entity
 * @author: GitHub Copilot
 * @date: 2026-01-26
 * @version: 1.0
 */
@Repository
public interface CommentRepository extends MongoRepository<Comment, String> {
    List<Comment> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(TargetType targetType, String targetId);
    List<Comment> findByParentIdOrderByCreatedAtAsc(String parentId);
}

