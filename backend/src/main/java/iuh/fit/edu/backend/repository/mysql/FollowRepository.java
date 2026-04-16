package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.Follow;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/*
 * @description: Repository for Follow entity
 * @author: The Bao
 * @date: 2026-03-19
 * @versio:n 1.0
 */
@Repository
public interface FollowRepository extends JpaRepository<Follow, Long> {
    // Get list of followers (people following this user)
    List<Follow> findByFollowing(User following);
    
    // Get list of following (people this user is following)
    List<Follow> findByFollower(User follower);
    
    // Count followers
    long countByFollowing(User following);
    
    // Count following
    long countByFollower(User follower);
    
    // Check if follower is following following
    boolean existsByFollowerAndFollowing(User follower, User following);
    
    // Get follow relationship
    Follow findByFollowerAndFollowing(User follower, User following);
}
