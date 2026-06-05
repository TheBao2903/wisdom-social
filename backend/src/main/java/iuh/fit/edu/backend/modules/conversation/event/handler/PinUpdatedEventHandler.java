package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.conversation.event.payload.PinUpdatedEvent;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class PinUpdatedEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return PinUpdatedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.PIN_MESSAGE.toString();
    }

    // Hàm xử lý sự kiện pin tin nhắn cho tất cả user đăng ký conversation
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        PinUpdatedEvent event = (PinUpdatedEvent) eventPayload;
        String destination = "/topic/conversations/" + event.getConversationId() + "/pins";
        // Bắn socket cho những người đăng ký kênh này
        messagingTemplate.convertAndSend(destination, event);
        log.info("Pin message to {}", destination);
    }
}