package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.event.payload.JoinRequestProcessedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class JoinRequestProcessedHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() { return JoinRequestProcessedEvent.class; }

    @Override
    public String getSupportedEventType() { return DomainEventType.JOIN_REQUEST_PROCESSED.toString(); }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        JoinRequestProcessedEvent event = (JoinRequestProcessedEvent) eventPayload;

        if (targetMemberIds == null || targetMemberIds.isEmpty()) return;

        for (Long memberId : targetMemberIds) {
            // Gửi tín hiệu về để FE biết mà xóa item này khỏi list
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
    }
}