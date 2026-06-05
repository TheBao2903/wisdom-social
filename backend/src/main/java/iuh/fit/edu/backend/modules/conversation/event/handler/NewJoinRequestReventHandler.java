/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberRoleUpdatedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.NewJoinRequestEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NewJoinRequestReventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() { return NewJoinRequestEvent.class; }

    @Override
    public String getSupportedEventType() { return DomainEventType.NEW_JOIN_REQUEST.toString(); }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        NewJoinRequestEvent event = (NewJoinRequestEvent) eventPayload;

        if (targetMemberIds == null || targetMemberIds.isEmpty())
            return;

        for(Long memberId : targetMemberIds){
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
        log.info("Broadcast new join request to {} members",targetMemberIds);
    }
}
