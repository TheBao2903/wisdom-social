package iuh.fit.edu.backend.modules.chat.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageSeenResponse;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

import java.util.Set;

@Getter
public class MessageSeenEvent {
    
    private final MessageSeenResponse messageSeenResponse;
    @JsonIgnore
    private final Set<Long> receiverIds;
    private final DomainEventType domainEventType;

    @JsonCreator
    public MessageSeenEvent(
            @JsonProperty("messageSeenResponse") MessageSeenResponse messageSeenResponse,
            @JsonProperty("receiverIds") Set<Long> receiverIds) {
        this.messageSeenResponse = messageSeenResponse;
        this.receiverIds = receiverIds;
        this.domainEventType = DomainEventType.MESSAGE_SEEN;
    }
}
