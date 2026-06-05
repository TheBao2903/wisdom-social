package iuh.fit.edu.backend.modules.chat.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import lombok.Getter;

@Getter
public class PollUpdatedEvent {
    private final PollResponse poll;
    private final DomainEventType domainEventType;

    @JsonCreator
    public PollUpdatedEvent(@JsonProperty("poll") PollResponse poll) {
        this.poll = poll;
        this.domainEventType = DomainEventType.POLL_UPDATED;
    }
}
