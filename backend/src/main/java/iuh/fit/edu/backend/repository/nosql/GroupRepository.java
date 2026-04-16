/*
 * @ (#) GroupRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.nosql.Group;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/*
 * @description: Group repository for MongoDB operations
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Repository
public interface GroupRepository extends MongoRepository<Group, String> {
    
    Optional<Group> findBySlug(String slug);
    
    List<Group> findByStatus(StatusType status);
    
    List<Group> findByCategory(String category);
    
    List<Group> findByCreatedBy(String createdBy);
}
