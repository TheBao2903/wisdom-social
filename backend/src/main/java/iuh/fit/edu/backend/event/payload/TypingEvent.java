/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import iuh.fit.edu.backend.dto.response.message.TypingResponse;
import iuh.fit.edu.backend.event.type.DomainEventType;
import lombok.Getter;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
public class TypingEvent {

    private final TypingResponse typingResponse;
    private final DomainEventType domainEventType;

    @JsonCreator
    public TypingEvent(@JsonProperty("typingResponse") TypingResponse typingResponse) {
        this.typingResponse = typingResponse;
        this.domainEventType = DomainEventType.TYPING;
    }
}
