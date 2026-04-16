package iuh.fit.edu.backend.event.handler;

import iuh.fit.edu.backend.event.payload.UserStatusEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserStatusEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return UserStatusEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return "";
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        // Kênh này dùng chung cho toàn bộ user đang mở app
        // Có thể tối ưu hơn bằng cách chỉ bắn cho danh sách bạn bè, nhưng tạm thời dùng kênh public cho dễ test
        UserStatusEvent event = (UserStatusEvent) eventPayload;
        String destination = "/topic/public/users/status";
        
        messagingTemplate.convertAndSend(destination, event);
        log.info("Đã bắn WebSocket UserStatusEvent tới {}", destination);
    }
}