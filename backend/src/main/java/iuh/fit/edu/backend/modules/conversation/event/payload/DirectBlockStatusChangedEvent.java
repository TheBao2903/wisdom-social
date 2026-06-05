package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

import java.util.Set;

@Getter
public class DirectBlockStatusChangedEvent {
    private final Long conversationId;
    private final Long blockerId;
    private final Long blockedId;
    private final boolean blocked;
    private final Set<Long> recipientUserIds;
    private final DomainEventType domainEventType = DomainEventType.DIRECT_BLOCK_STATUS_CHANGED;

    @JsonCreator
    public DirectBlockStatusChangedEvent(
            @JsonProperty("conversationId") Long conversationId,
            @JsonProperty("blockerId") Long blockerId,
            @JsonProperty("blockedId") Long blockedId,
            @JsonProperty("blocked") boolean blocked,
            @JsonProperty("recipientUserIds") Set<Long> recipientUserIds) {
        this.conversationId = conversationId;
        this.blockerId = blockerId;
        this.blockedId = blockedId;
        this.blocked = blocked;
        this.recipientUserIds = recipientUserIds;
    }
}
