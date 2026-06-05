/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.payload;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.dto.response.LastMessageResponse;
import lombok.Getter;

import java.util.Set;

@Getter
public class ConversationUpdatedEvent{
    private final Long conversationId;
    private final LastMessageResponse lastMessage;
    private final DomainEventType domainEventType;

    // Field này chỉ dùng để Server biết gửi cho ai, không gửi xuống Client
    @JsonIgnore
    private final Set<Long> memberIds;


    @JsonCreator
    public ConversationUpdatedEvent(
            @JsonProperty("conversationId") Long conversationId,
            @JsonProperty("lastMessage") LastMessageResponse lastMessage,
            @JsonProperty("memberIds") Set<Long> memberIds) {
        this.conversationId = conversationId;
        this.lastMessage = lastMessage;
        this.domainEventType = DomainEventType.ROOM_UPDATED;
        this.memberIds = memberIds;
    }
}
