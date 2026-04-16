package iuh.fit.edu.backend.event.handler;

import iuh.fit.edu.backend.event.payload.MessageRecalledEvent;
import iuh.fit.edu.backend.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageRecalledEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MessageRecalledEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MESSAGE_RECALLED.toString();
    }

    // Hàm xử lý sự kiện thu hồi tin nhắn cho tất cả user đăng ký conversation
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MessageRecalledEvent event = (MessageRecalledEvent) eventPayload;
        String destination = "/topic/conversation/" + event.getMessageRecalledResponse().getConversationId();
        // Bắn socket qua cho tất cả người dùng đăng ký kênh này
        messagingTemplate.convertAndSend(destination, event);
        log.info("Recall message to {}", destination);
    }
}