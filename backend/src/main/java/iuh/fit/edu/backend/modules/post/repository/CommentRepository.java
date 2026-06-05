/*
 * @ (#) CommentRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.post.entity.Comment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/*
 * @description: Repository for Comment entity with tree-based pagination
 * @author: The Bao
 * @date: 2026-01-26
 * @version: 1.0
 */
@Repository
public interface CommentRepository extends MongoRepository<Comment, String> {
    List<Comment> findByUserIdAndStatus(String userId, StatusType status);
    
    // Get root comments (cấp 1) của target - sắp xếp mới → cũ
    List<Comment> findByTargetTypeAndTargetIdAndParentIdIsNullOrderByCreatedAtDesc(
            TargetType targetType, String targetId, Pageable pageable);
    
    // Count root comments
    long countByTargetTypeAndTargetIdAndParentIdIsNull(TargetType targetType, String targetId);

    // Count all comments (all levels) for target
    long countByTargetTypeAndTargetId(TargetType targetType, String targetId);
    
    // Get replies (cấp 2+) của parent comment - sắp xếp cũ → mới
    List<Comment> findByParentIdOrderByCreatedAtAsc(String parentId, Pageable pageable);

    // Get latest replies (cấp 2+) của parent comment - sắp xếp mới → cũ
    List<Comment> findByParentIdOrderByCreatedAtDesc(String parentId, Pageable pageable);
    
    // Cursor-based pagination: lấy reply sau một thời điểm
    @Query("{'parentId': ?0, 'createdAt': {$gt: ?1}, 'status': 'ACTIVE'}")
    List<Comment> findRepliesAfterCursor(String parentId, Instant cursor, Pageable pageable);

    // Cursor-based pagination: lấy reply cũ hơn một thời điểm (newest-first pagination)
    @Query("{'parentId': ?0, 'createdAt': {$lt: ?1}, 'status': 'ACTIVE'}")
    List<Comment> findRepliesBeforeCursor(String parentId, Instant cursor, Pageable pageable);
    
    // Count replies
    long countByParentId(String parentId);
    
    // Legacy methods (keep for backward compatibility)
    List<Comment> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(TargetType targetType, String targetId);
    List<Comment> findByParentIdOrderByCreatedAtAsc(String parentId);
}

