package iuh.fit.edu.backend.modules.chat.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.event.payload.PollUpdatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class PollUpdatedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return PollUpdatedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.POLL_UPDATED.toString();
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        PollUpdatedEvent event = (PollUpdatedEvent) eventPayload;
        String destination = "/topic/conversation/" + event.getPoll().getConversationId();
        messagingTemplate.convertAndSend(destination, event);
        log.info("Send poll update to {}", destination);
    }
}
