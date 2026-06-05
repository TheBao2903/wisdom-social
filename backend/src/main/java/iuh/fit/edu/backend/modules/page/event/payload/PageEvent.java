package iuh.fit.edu.backend.modules.page.event.payload;

import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageEvent {
    private DomainEventType eventType;
    private long pageId;
    private long userId;
    private String newRole;
    private String timestamp;
    private boolean sendToPage;
    private boolean sendToUser;
}
