package iuh.fit.edu.backend.modules.chat.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.chat.event.payload.MessageReactionEvent;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageReactionEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MessageReactionEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MESSAGE_REACTION.toString();
    }

    // Hàm xử lý sự kiện bắn tin nhắn cho tất cả user đăng ký conversation
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MessageReactionEvent event = (MessageReactionEvent) eventPayload;
        String destination = "/topic/conversation/" + event.getMessageResponse().getConversationId();
        // Bắn socket qua cho tất cả người dùng đăng ký kênh này
        messagingTemplate.convertAndSend(destination, event);
        log.info("Send message reaction update to {}", destination);
    }
}
