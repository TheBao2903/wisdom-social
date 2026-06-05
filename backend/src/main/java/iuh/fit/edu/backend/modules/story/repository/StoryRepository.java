/*
 * @ (#) StoryRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.repository;

import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.story.entity.Story;
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
    
    // Get user's stories (all ACTIVE, for owner) — excludes soft-deleted
    List<Story> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, StatusType status);

    // Get active user's stories (within 24h)
    List<Story> findByUserIdAndStatusAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            String userId, StatusType status, Instant since
    );
    
    // Get public stories from user (within 24h)
    @Query("""
        {
            'userId': ?0,
            'status': ?1,
            'createdAt': { $gte: ?2 },
            $or: [
                { 'privacy': { $exists: false } },
                { 'privacy': null },
                { 'privacy': 'PUBLIC' }
            ]
        }
        """)
    List<Story> findUserStoriesPublic(String userId, StatusType status, Instant twentyFourHoursAgo);

    // Get stories from user for friends (within 24h)
    @Query("""
        {
            'userId': ?0,
            'status': ?1,
            'createdAt': { $gte: ?2 },
            $or: [
                { 'privacy': { $exists: false } },
                { 'privacy': null },
                { 'privacy': { $in: ['PUBLIC', 'FRIENDS'] } }
            ]
        }
        """)
    List<Story> findUserStoriesFriends(String userId, StatusType status, Instant twentyFourHoursAgo);
    
    // Get feed stories from multiple users (within 24h)
    @Query(value = """
        {
            'status': ?1,
            'createdAt': { $gte: ?2 },
            $or: [
                { 'userId': ?3 },
                {
                    'userId': { $in: ?0 },
                    $or: [
                        { 'privacy': { $exists: false } },
                        { 'privacy': null },
                        { 'privacy': { $in: ['PUBLIC', 'FRIENDS'] } }
                    ]
                }
            ]
        }
        """)
    Page<Story> findFeedStories(List<String> userIds, StatusType status, Instant twentyFourHoursAgo, String currentUserId, Pageable pageable);
    
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
    
    // Count user's active stories (within 24h, not archived)
    long countByUserIdAndStatusAndCreatedAtGreaterThan(
            String userId,
            StatusType status,
            Instant since
    );

    // Check if user has any active story (for avatar blue border)
    boolean existsByUserIdAndStatusAndCreatedAtGreaterThanEqual(
            String userId,
            StatusType status,
            Instant since
    );
}

