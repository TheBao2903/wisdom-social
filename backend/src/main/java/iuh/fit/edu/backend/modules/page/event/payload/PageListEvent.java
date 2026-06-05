package iuh.fit.edu.backend.modules.page.event.payload;

import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.page.entity.Page;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for page list events (created / updated / deleted).
 * Published to Redis and then forwarded to WebSocket topic:
 *   /topic/pages
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageListEvent {
    private DomainEventType eventType;
    private long pageId;
    /** Full page payload — populated for CREATED and UPDATED events */
    private Object page;
    private String timestamp;
}
