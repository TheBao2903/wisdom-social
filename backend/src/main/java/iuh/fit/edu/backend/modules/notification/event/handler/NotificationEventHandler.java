package iuh.fit.edu.backend.modules.notification.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.notification.entity.mongodb.Notification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return Notification.class;
    }

    @Override
    public String getSupportedEventType() {
        return "NOTIFICATION";
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        if (!(eventPayload instanceof Notification)) {
            return;
        }
        
        Notification notification = (Notification) eventPayload;
        
        // Use targetMemberIds if provided, otherwise fallback to notification.recipientId
        if (targetMemberIds != null && !targetMemberIds.isEmpty()) {
            log.info("📡 [DEBUG-NOTI] 3a. Handler processing via targetMemberIds: {}", targetMemberIds);
            targetMemberIds.forEach(userId -> sendToUser(userId.toString(), notification));
        } else if (notification.getRecipientId() != null) {
            log.info("📡 [DEBUG-NOTI] 3b. Handler processing via fallback recipientId: {}", notification.getRecipientId());
            sendToUser(notification.getRecipientId(), notification);
        } else {
            log.warn("❌ [DEBUG-NOTI] Handler failed: No recipient found in payload");
        }
    }

    private void sendToUser(String userId, Notification notification) {
        String destination = "/topic/user/" + userId + "/notifications";
        log.info("📡 [DEBUG-NOTI] 4. Sending to WebSocket destination: {}", destination);
        messagingTemplate.convertAndSend(destination, notification);
    }
}
