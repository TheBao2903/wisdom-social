package iuh.fit.edu.backend.modules.page.event.payload;

import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for page post events (submit / approve / reject / remove).
 * Published to Redis and then forwarded to WebSocket topic:
 *   /topic/page/{pageId}/posts
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagePostEvent {
    private DomainEventType eventType;
    private long pageId;
    /** MongoDB ObjectId string of the post */
    private String postId;
    /** Optional full post payload (populated by the handler if needed) */
    private Object post;
    private long userId;
    private String timestamp;
}
