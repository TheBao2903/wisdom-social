/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import lombok.Getter;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
public class MessageCreatedEvent{
    private final MessageResponse messageResponse;
    private final DomainEventType domainEventType;

    @JsonCreator
    public MessageCreatedEvent(@JsonProperty("messageResponse") MessageResponse messageResponse) {
        this.messageResponse = messageResponse;
        this.domainEventType = DomainEventType.MESSAGE_CREATED;
    }
}
