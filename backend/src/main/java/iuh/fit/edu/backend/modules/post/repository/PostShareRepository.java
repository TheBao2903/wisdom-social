/*
 * @ (#) PostShareRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.post.entity.PostShare;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostShareRepository extends MongoRepository<PostShare, String> {
    List<PostShare> findByOriginalPostId(String originalPostId);
    List<PostShare> findBySharedByUserIdOrderByCreatedAtDesc(String sharedByUserId);
    List<PostShare> findBySharedByUserIdAndStatus(String sharedByUserId, StatusType status);
}

