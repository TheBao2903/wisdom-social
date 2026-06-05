/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
public class MemberStatusChangedEvent {
    private final ConversationResponse conversationResponse;
    private final DomainEventType domainEventType;

    // Field này chỉ dùng để Server biết gửi cho ai, không gửi xuống Client
    @JsonIgnore
    private final Set<Long> memberIds;


    @JsonCreator
    public MemberStatusChangedEvent(
            @JsonProperty("conversationResponse") ConversationResponse conversationResponse,
            @JsonProperty("domainEventType") DomainEventType domainEventType,
            @JsonProperty("memberIds") Set<Long> memberIds) {
        this.conversationResponse = conversationResponse;
        this.domainEventType = domainEventType;
        this.memberIds = memberIds;
    }
}
