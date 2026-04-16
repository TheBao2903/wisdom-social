package iuh.fit.edu.backend.domain.entity.nosql;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Story WebSocket Event - sent over STOMP channels
 * 
 * Event Types:
 * - NEW_STORY: User posted a new story
 * - STORY_VIEW: Someone viewed a story
 * - STORY_REACTION: Someone reacted to a story
 * - STORY_DELETED: Story was deleted
 * - STORY_ARCHIVED: Story moved to highlights
 * - STORY_UNARCHIVED: Story removed from highlights
 * 
 * Published to:
 * - /topic/stories/feed (NEW_STORY)
 * - /topic/stories/{storyId} (STORY_VIEW, STORY_REACTION)
 * - /topic/users/{userId}/stories (all events for this user's stories)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoryEvent {
    
    /**
     * Event type (NEW_STORY, STORY_VIEW, etc.)
     */
    private String type;
    
    /**
     * Story ID
     */
    private String storyId;
    
    /**
     * User who performed the action (for views/reactions)
     * or story author (for NEW_STORY)
     */
    private String userId;
    
    /**
     * Event-specific data
     * Examples:
     * - NEW_STORY: { "story": {...full story object...} }
     * - STORY_VIEW: { "viewerId": "xxx", "viewCount": 42 }
     * - STORY_REACTION: { "reactCount": 15 }
     * - STORY_ARCHIVED: { "highlightCategory": "Favorites" }
     */
    private Map<String, Object> data;
    
    /**
     * Timestamp of event
     */
    private Instant timestamp;
}
