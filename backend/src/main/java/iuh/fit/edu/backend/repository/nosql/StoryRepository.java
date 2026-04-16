/*
 * @ (#) StoryRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.nosql.Story;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface StoryRepository extends MongoRepository<Story, String> {
    
    // Get user's stories (all, for owner)
    List<Story> findByUserIdOrderByCreatedAtDesc(String userId);
    
    // Get public stories from user (within 24h or archived)
    @Query("""
        {
            'userId': ?0,
            'status': 'ACTIVE',
            $or: [
                { 'createdAt': { $gte: ?1 } },
                { 'isArchived': true }
            ]
        }
        """)
    List<Story> findUserStoriesPublic(String userId, Instant twentyFourHoursAgo);
    
    // Get feed stories from multiple users (within 24h or archived)
    @Query("""
        {
            'userId': { $in: ?0 },
            'status': 'ACTIVE',
            $or: [
                { 'createdAt': { $gte: ?1 } },
                { 'isArchived': true }
            ]
        }
        """)
    Page<Story> findFeedStories(List<String> userIds, Instant twentyFourHoursAgo, Pageable pageable);
    
    // Find story by ID and status
    Optional<Story> findByIdAndStatus(String storyId, StatusType status);
    
    // Find archived stories
    List<Story> findByUserIdAndIsArchivedTrue(String userId);
    
    // Find active stories within time period
    List<Story> findByUserIdInAndStatusAndCreatedAtGreaterThanEqual(
            List<String> userIds,
            StatusType status,
            Instant createdAfter
    );
    
    // Count user's active stories
    long countByUserIdAndStatusAndCreatedAtGreaterThan(
            String userId,
            StatusType status,
            Instant since
    );
}

