package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

import java.util.Set;

@Getter
public class BlockedMembersUpdatedEvent {
    private final Long conversationId;
    private final Long targetUserId;
    private final boolean blocked;
    @JsonIgnore
    private final Set<Long> notifyAdminIds;
    private final DomainEventType domainEventType;

    @JsonCreator
    public BlockedMembersUpdatedEvent(
            @JsonProperty("conversationId") Long conversationId,
            @JsonProperty("targetUserId") Long targetUserId,
            @JsonProperty("blocked") boolean blocked,
            @JsonProperty("notifyAdminIds") Set<Long> notifyAdminIds) {
        this.conversationId = conversationId;
        this.targetUserId = targetUserId;
        this.blocked = blocked;
        this.notifyAdminIds = notifyAdminIds;
        this.domainEventType = DomainEventType.CONVERSATION_BLOCKED_MEMBERS_UPDATED;
    }
}
