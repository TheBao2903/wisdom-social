/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageRecalledResponse;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
public class MessageRecalledEvent{
    private final MessageRecalledResponse messageRecalledResponse;
    private final DomainEventType domainEventType;


    @JsonCreator
    public MessageRecalledEvent(@JsonProperty("messageRecalledResponse") MessageRecalledResponse messageRecalledResponse) {
        this.messageRecalledResponse = messageRecalledResponse;
        this.domainEventType = DomainEventType.MESSAGE_RECALLED;
    }
}
