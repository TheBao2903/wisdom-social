/*
 * @ (#) PostRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.post.entity.Post;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;

import java.util.List;

@Repository
public interface PostRepository extends MongoRepository<Post, String>, PostFeedRepositoryCustom {
    List<Post> findByAuthorIdOrderByCreatedAtDesc(String authorId);
    @Query("{ 'authorId': ?#{[0].toString()} }")
    Page<Post> findByAuthorId(Long authorId, Pageable pageable);

    @Query(value = "{ 'authorId': ?#{[0].toString()} }", count = true)
    long countByAuthorId(Long authorId);

    List<Post> findByTaggedUserIdsContaining(String userId);

    @Query("{ '_id': ?0 }")
    @Update("{ '$set': { 'lastActivityAt': ?1 } }")
    void updateLastActivityAt(String postId, Instant timestamp);
}
