package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.event.payload.DirectBlockStatusChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DirectBlockStatusChangedEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return DirectBlockStatusChangedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.DIRECT_BLOCK_STATUS_CHANGED.toString();
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        DirectBlockStatusChangedEvent event = (DirectBlockStatusChangedEvent) eventPayload;

        String membersDestination = "/topic/conversations/" + event.getConversationId() + "/members";
        messagingTemplate.convertAndSend(membersDestination, event);

        if (targetMemberIds != null) {
            for (Long memberId : targetMemberIds) {
                messagingTemplate.convertAndSend("/topic/user/" + memberId + "/conversations", event);
            }
        }

        log.info("Send direct block status change to {} and {} sidebar recipient(s)",
                membersDestination, targetMemberIds == null ? 0 : targetMemberIds.size());
    }
}
