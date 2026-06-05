package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.event.payload.BlockedMembersUpdatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class BlockedMembersUpdatedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return BlockedMembersUpdatedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.CONVERSATION_BLOCKED_MEMBERS_UPDATED.toString();
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        BlockedMembersUpdatedEvent event = (BlockedMembersUpdatedEvent) eventPayload;
        if (targetMemberIds == null || targetMemberIds.isEmpty()) return;

        for (Long memberId : targetMemberIds) {
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
        log.info("Broadcast blocked members update to {} admins", targetMemberIds);
    }
}
