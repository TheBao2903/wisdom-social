package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.dto.response.LastMessageResponse;
import lombok.Getter;

import java.util.Set;

@Getter
public class GroupDisbandedEvent {

    private final Long conversationId;
    private final DomainEventType domainEventType;
    private final LastMessageResponse lastMessage;

    @JsonIgnore
    private final Set<Long> memberIds;

    @JsonCreator
    public GroupDisbandedEvent(
            @JsonProperty("conversationId") Long conversationId,
            @JsonProperty("memberIds") Set<Long> memberIds,
            @JsonProperty("lastMessage") LastMessageResponse lastMessage) {
        this.conversationId = conversationId;
        this.domainEventType = DomainEventType.GROUP_DISBANDED;
        this.memberIds = memberIds;
        this.lastMessage = lastMessage;
    }
}
