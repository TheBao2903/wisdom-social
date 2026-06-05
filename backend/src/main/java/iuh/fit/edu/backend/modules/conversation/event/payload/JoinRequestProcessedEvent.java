package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.dto.response.JoinRequestResponse;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Set;

@Getter
@AllArgsConstructor
public class JoinRequestProcessedEvent {
    private final Long requestId;
    private final Long conversationId;
    @JsonIgnore
    private final Set<Long> notifyAdminIds;

    private final DomainEventType domainEventType;

    @JsonCreator
    public JoinRequestProcessedEvent(@JsonProperty("conversationId") Long conversationId,
                               @JsonProperty("requestId") Long requestId,
                               @JsonProperty("notifyAdminIds") Set<Long> notifyAdminIds) {
        this.conversationId = conversationId;
        this.requestId = requestId;
        this.notifyAdminIds = notifyAdminIds;
        this.domainEventType = DomainEventType.JOIN_REQUEST_PROCESSED;
    }
}