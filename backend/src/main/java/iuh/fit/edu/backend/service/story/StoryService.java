package iuh.fit.edu.backend.service.story;

import iuh.fit.edu.backend.domain.entity.nosql.Story;
import iuh.fit.edu.backend.domain.entity.nosql.StoryView;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Story Service Interface
 * - Visibility rules (24h public, archived permanent)
 * - View tracking (prevent duplicates)
 * - Reactions and interactions
 * - Feed generation
 * - File uploads to S3
 */
public interface StoryService {

    /**
     * Create a new story with file uploads
     * - First creates story in MongoDB to get ID
     * - Then uploads media files to S3
     * - Finally updates story with media URLs
     */
    Story createStory(Story story, String userId, List<String> mediaUrls) throws IOException;

    /**
     * Get feed stories (from current user + friends)
     * - Only active stories
     * - Created within 24h OR archived
     * - Respects privacy settings
     */
    Page<Story> getFeedStories(List<String> userIds, Pageable pageable);

    /**
     * Get user's stories (for profile view)
     * - If owner: return all stories
     * - If not owner: return only recent (24h) or archived
     */
    List<Story> getUserStories(String userId, String currentUserId);

    /**
     * Record a story view
     * - Prevent duplicate views using unique index on (storyId, viewerId)
     * - If new view, increment viewCount
     * - Return true if new view, false if duplicate
     */
    boolean recordView(String storyId, String viewerId);

    /**
     * Get viewers of a story (sorted by latest first)
     */
    List<StoryView> getStoryViewers(String storyId);

    /**
     * Add reaction to story
     */
    void reactToStory(String storyId);

    /**
     * Archive story (add to highlights)
     * - Set isArchived = true
     * - Set name for highlight category
     * - IMPORTANT: DO NOT update expireAt (already set from creation)
     */
    Story archiveStory(String storyId, String highlightCategory);

    /**
     * Remove story from highlights (unarchive)
     */
    Story unarchiveStory(String storyId);

    /**
     * Soft delete story
     */
    void deleteStory(String storyId);

    /**
     * Check if user can view story
     * - Owner can always view
     * - Privacy settings
     * - Not deleted
     */
    boolean canViewStory(Story story, String requesterId);

    /**
     * Get story by ID (for API)
     */
    Optional<Story> getStory(String storyId);

    /**
     * Get highlighted stories for user
     */
    List<Story> getHighlights(String userId);

    /**
     * Check story existence and ownership
     */
    boolean isStoryOwner(String storyId, String userId);

    /**
     * Save story to repository
     */
    Story saveStory(Story story, String userId);
}
