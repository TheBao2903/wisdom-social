package iuh.fit.edu.backend.event.handler;

import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import iuh.fit.edu.backend.event.payload.MessageCreatedEvent;
import iuh.fit.edu.backend.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageCreatedEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MessageCreatedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MESSAGE_CREATED.toString();
    }

    // Hàm xử lý sự kiện bắn tin nhắn cho tất cả user đăng ký conversation
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MessageCreatedEvent event = (MessageCreatedEvent) eventPayload;
        String destination = "/topic/conversation/" + event.getMessageResponse().getConversationId();
        // Bắn socket qua cho tất cả người dùng đăng ký kênh này
        messagingTemplate.convertAndSend(destination, event);
        log.info("Send new message to {}", destination);
    }
}