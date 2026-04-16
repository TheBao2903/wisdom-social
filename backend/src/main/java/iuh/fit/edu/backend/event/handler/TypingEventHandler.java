package iuh.fit.edu.backend.event.handler;

import iuh.fit.edu.backend.event.payload.TypingEvent;
import iuh.fit.edu.backend.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class TypingEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return TypingEvent.class;
    }
    @Override
    public String getSupportedEventType() {
        return DomainEventType.TYPING.toString();
    }

    // Hàm xử lý sự kiện đang gõ tin nhắn cho tất cả user đăng ký conversation
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        TypingEvent event = (TypingEvent) eventPayload;
        String destination = "/topic/conversation/" + event.getTypingResponse().getConversationId();
        messagingTemplate.convertAndSend(destination, event);
        log.info("Typing message to {}", destination);
    }
}