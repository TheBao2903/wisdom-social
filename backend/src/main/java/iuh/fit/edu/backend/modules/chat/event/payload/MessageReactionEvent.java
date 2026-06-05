package iuh.fit.edu.backend.modules.chat.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import lombok.Getter;

@Getter
public class MessageReactionEvent {
    private final MessageResponse messageResponse;
    private final DomainEventType domainEventType;

    @JsonCreator
    public MessageReactionEvent(@JsonProperty("messageResponse") MessageResponse messageResponse) {
        this.messageResponse = messageResponse;
        this.domainEventType = DomainEventType.MESSAGE_REACTION;
    }
}
