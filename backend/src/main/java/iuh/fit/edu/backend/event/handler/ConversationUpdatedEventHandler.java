/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.handler;

import iuh.fit.edu.backend.event.payload.ConversationUpdatedEvent;
import iuh.fit.edu.backend.event.payload.MemberUpdatedEvent;
import iuh.fit.edu.backend.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ConversationUpdatedEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return ConversationUpdatedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.ROOM_UPDATED.toString();
    }

    /**
     * Cập nhật danh sách chat (Sidebar) cho TẤT CẢ thành viên.
     * Gửi tin nhắn tóm tắt (LastMessageDTO) vào topic riêng của từng user.
     */
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        log.info("BUg");
        ConversationUpdatedEvent event = (ConversationUpdatedEvent) eventPayload;

        if (targetMemberIds == null || targetMemberIds.isEmpty())
            return;
        for(Long memberId : event.getMemberIds()){
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
        log.info("Broadcast conversation update to {} members", event.getMemberIds());
    }
}
