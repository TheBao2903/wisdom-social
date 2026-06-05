package iuh.fit.edu.backend.modules.post.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
public class ReactionEvent {
    private String action; // "REACT" or "UNREACT"
    private String rootPostId; // Required to route the websocket message to the correct post topic
    private TargetType targetType; // POST or COMMENT
    private String targetId;
    private ReactionType reactionType;
    private String userId;
    private long totalCount; // Optional: The new total count for that target
    @Builder.Default
    private DomainEventType domainEventType = DomainEventType.REACTION;

    @JsonCreator
    public ReactionEvent(
            @JsonProperty("action") String action,
            @JsonProperty("rootPostId") String rootPostId,
            @JsonProperty("targetType") TargetType targetType,
            @JsonProperty("targetId") String targetId,
            @JsonProperty("reactionType") ReactionType reactionType,
            @JsonProperty("userId") String userId,
            @JsonProperty("totalCount") long totalCount,
            @JsonProperty("domainEventType") DomainEventType domainEventType) {
        this.action = action;
        this.rootPostId = rootPostId;
        this.targetType = targetType;
        this.targetId = targetId;
        this.reactionType = reactionType;
        this.userId = userId;
        this.totalCount = totalCount;
        this.domainEventType = domainEventType != null ? domainEventType : DomainEventType.REACTION;
    }

    public ReactionEvent(String action, String rootPostId, TargetType targetType, String targetId, ReactionType reactionType, String userId, long totalCount) {
        this.action = action;
        this.rootPostId = rootPostId;
        this.targetType = targetType;
        this.targetId = targetId;
        this.reactionType = reactionType;
        this.userId = userId;
        this.totalCount = totalCount;
        this.domainEventType = DomainEventType.REACTION;
    }
}
