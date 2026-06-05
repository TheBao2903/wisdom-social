package iuh.fit.edu.backend.modules.notification.event.payload;


import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Domain event for notifications
 */
@Data
@Builder
@NoArgsConstructor
public class NotificationEvent {
    private String recipientId;
    private List<String> actorIds;
    private NotificationType type;
    private TargetType targetType;
    private String targetId;
    private String rootTargetId; // The ID of the root object (e.g., Post ID) for nested targets (e.g., Comment)
    private String content;
    private String imageUrl;
    @Builder.Default
    private DomainEventType domainEventType = DomainEventType.NOTIFICATION;

    @JsonCreator
    public NotificationEvent(
            @JsonProperty("recipientId") String recipientId,
            @JsonProperty("actorIds") List<String> actorIds,
            @JsonProperty("type") NotificationType type,
            @JsonProperty("targetType") TargetType targetType,
            @JsonProperty("targetId") String targetId,
            @JsonProperty("rootTargetId") String rootTargetId,
            @JsonProperty("content") String content,
            @JsonProperty("imageUrl") String imageUrl,
            @JsonProperty("domainEventType") DomainEventType domainEventType) {
        this.recipientId = recipientId;
        this.actorIds = actorIds;
        this.type = type;
        this.targetType = targetType;
        this.targetId = targetId;
        this.rootTargetId = rootTargetId;
        this.content = content;
        this.imageUrl = imageUrl;
        this.domainEventType = domainEventType != null ? domainEventType : DomainEventType.NOTIFICATION;
    }

    public NotificationEvent(String recipientId, List<String> actorIds, NotificationType type, TargetType targetType, String targetId, String rootTargetId, String content, String imageUrl) {
        this.recipientId = recipientId;
        this.actorIds = actorIds;
        this.type = type;
        this.targetType = targetType;
        this.targetId = targetId;
        this.rootTargetId = rootTargetId;
        this.content = content;
        this.imageUrl = imageUrl;
        this.domainEventType = DomainEventType.NOTIFICATION;
    }
}
