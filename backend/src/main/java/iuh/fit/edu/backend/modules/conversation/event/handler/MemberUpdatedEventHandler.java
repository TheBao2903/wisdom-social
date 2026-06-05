/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberUpdatedEvent;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
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
public class MemberUpdatedEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MemberUpdatedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MEMBER_UPDATED.toString();
    }

    // Hàm xử lý sự kiện cập nhật thông tin của một thành viên cho tất cả user đăng ký conversation
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MemberUpdatedEvent event = (MemberUpdatedEvent) eventPayload;
        // Kênh để Frontend subscribe. Ví dụ: /topic/conversations/123/members
        String destination = "/topic/conversations/" + event.getConversationId() + "/members";

        // Gửi toàn bộ Object (có chứa newNickname, newAvatar) xuống cho FE
        messagingTemplate.convertAndSend(destination, event);
        log.info("Send update member to {}", destination);
    }
}
