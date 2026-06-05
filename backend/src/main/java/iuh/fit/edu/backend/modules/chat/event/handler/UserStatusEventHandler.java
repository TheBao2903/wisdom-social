package iuh.fit.edu.backend.modules.chat.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.chat.event.payload.UserStatusEvent;
import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.modules.user.service.UserPresenceService;
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
    private final UserPresenceService userPresenceService;

    @Override
    public Class<?> getSupportedClass() {
        return UserStatusEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.USER_STATUS.toString();
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        UserStatusEvent event = (UserStatusEvent) eventPayload;
        UserStatusResponse status = event.getPayload();
        Set<Long> recipients = targetMemberIds == null || targetMemberIds.isEmpty()
                ? userPresenceService.getPresenceRecipientIds(status.getUserId())
                : targetMemberIds;

        // Mỗi client chỉ nghe kênh presence của chính mình; backend lọc người nhận để tránh lộ trạng thái rộng.
        for (Long recipientId : recipients) {
            messagingTemplate.convertAndSend("/topic/user/" + recipientId + "/presence", event);
        }
        log.info("Published UserStatusEvent of user {} to {} recipients", status.getUserId(), recipients.size());
    }
}
