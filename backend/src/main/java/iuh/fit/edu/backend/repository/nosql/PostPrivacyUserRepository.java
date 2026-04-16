/*
 * @ (#) PostPrivacyUserRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.domain.entity.nosql.PostPrivacyUser;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostPrivacyUserRepository extends MongoRepository<PostPrivacyUser, String> {
    List<PostPrivacyUser> findByTargetId(String targetId);
}

