package iuh.fit.edu.backend.modules.story.service;

import iuh.fit.edu.backend.modules.story.entity.Story;
import iuh.fit.edu.backend.modules.story.entity.StoryEvent;
import iuh.fit.edu.backend.modules.story.dto.response.StoryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Story Event Publisher - broadcasts real-time story updates via WebSocket
 * 
 * Channels:
 * - /topic/stories/feed - NEW_STORY events (broadcast to all users)
 * - /topic/stories/{storyId} - STORY_VIEW and STORY_REACTION (story-specific)
 * - /topic/users/{userId}/stories - all events for user's stories (user-specific)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StoryEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Publish NEW_STORY event to feed
     * Sent to: /topic/stories/feed
     */
    public void publishNewStory(Story story, StoryResponse response) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("story", response);

            StoryEvent event = StoryEvent.builder()
                    .type("NEW_STORY")
                    .storyId(story.getId())
                    .userId(story.getUserId())
                    .data(data)
                    .timestamp(Instant.now())
                    .build();

            messagingTemplate.convertAndSend("/topic/stories/feed", event);
            log.info("Published NEW_STORY event: {}", story.getId());

        } catch (Exception e) {
            log.error("Failed to publish NEW_STORY event: {}", e.getMessage());
        }
    }

    /**
     * Publish STORY_VIEW event
     * Sent to: /topic/stories/{storyId} and /topic/users/{userId}/stories
     */
    public void publishStoryView(String storyId, String viewerId, int newViewCount, String storyOwnerId) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("viewerId", viewerId);
            data.put("viewCount", newViewCount);

            StoryEvent event = StoryEvent.builder()
                    .type("STORY_VIEW")
                    .storyId(storyId)
                    .userId(viewerId)
                    .data(data)
                    .timestamp(Instant.now())
                    .build();

            // Send to story-specific channel (all viewers see updated count)
            messagingTemplate.convertAndSend("/topic/stories/" + storyId, event);

            // Send to owner's personal channel (so they get notified of who viewed)
            messagingTemplate.convertAndSend("/topic/users/" + storyOwnerId + "/stories", event);

            log.info("Published STORY_VIEW event: storyId={}, viewerId={}", storyId, viewerId);

        } catch (Exception e) {
            log.error("Failed to publish STORY_VIEW event: {}", e.getMessage());
        }
    }

    /**
     * Publish STORY_REACTION event
     * Sent to: /topic/stories/{storyId} and /topic/users/{userId}/stories
     */
    public void publishStoryReaction(String storyId, String reactorId, int newReactCount, String storyOwnerId) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("reactorId", reactorId);
            data.put("reactCount", newReactCount);

            StoryEvent event = StoryEvent.builder()
                    .type("STORY_REACTION")
                    .storyId(storyId)
                    .userId(reactorId)
                    .data(data)
                    .timestamp(Instant.now())
                    .build();

            // Send to story-specific channel
            messagingTemplate.convertAndSend("/topic/stories/" + storyId, event);

            // Send to owner's personal channel
            messagingTemplate.convertAndSend("/topic/users/" + storyOwnerId + "/stories", event);

            log.info("Published STORY_REACTION event: storyId={}, reactorId={}", storyId, reactorId);

        } catch (Exception e) {
            log.error("Failed to publish STORY_REACTION event: {}", e.getMessage());
        }
    }

    /**
     * Publish STORY_DELETED event
     * Sent to: /topic/stories/{storyId} and /topic/users/{userId}/stories
     */
    public void publishStoryDeleted(String storyId, String storyOwnerId) {
        try {
            StoryEvent event = StoryEvent.builder()
                    .type("STORY_DELETED")
                    .storyId(storyId)
                    .userId(storyOwnerId)
                    .timestamp(Instant.now())
                    .build();

            messagingTemplate.convertAndSend("/topic/stories/" + storyId, event);
            messagingTemplate.convertAndSend("/topic/users/" + storyOwnerId + "/stories", event);

            log.info("Published STORY_DELETED event: {}", storyId);

        } catch (Exception e) {
            log.error("Failed to publish STORY_DELETED event: {}", e.getMessage());
        }
    }

    /**
     * Publish STORY_ARCHIVED event (moved to highlights)
     * Sent to: /topic/users/{userId}/stories
     */
    public void publishStoryArchived(String storyId, String storyOwnerId, String highlightCategory) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("highlightCategory", highlightCategory);

            StoryEvent event = StoryEvent.builder()
                    .type("STORY_ARCHIVED")
                    .storyId(storyId)
                    .userId(storyOwnerId)
                    .data(data)
                    .timestamp(Instant.now())
                    .build();

            messagingTemplate.convertAndSend("/topic/users/" + storyOwnerId + "/stories", event);

            log.info("Published STORY_ARCHIVED event: {}", storyId);

        } catch (Exception e) {
            log.error("Failed to publish STORY_ARCHIVED event: {}", e.getMessage());
        }
    }

    /**
     * Publish STORY_UNARCHIVED event (removed from highlights)
     * Sent to: /topic/users/{userId}/stories
     */
    public void publishStoryUnarchived(String storyId, String storyOwnerId) {
        try {
            StoryEvent event = StoryEvent.builder()
                    .type("STORY_UNARCHIVED")
                    .storyId(storyId)
                    .userId(storyOwnerId)
                    .timestamp(Instant.now())
                    .build();

            messagingTemplate.convertAndSend("/topic/users/" + storyOwnerId + "/stories", event);

            log.info("Published STORY_UNARCHIVED event: {}", storyId);

        } catch (Exception e) {
            log.error("Failed to publish STORY_UNARCHIVED event: {}", e.getMessage());
        }
    }
}
