/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberStatusChangedEvent;
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
public class MemberKickedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MemberStatusChangedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MEMBER_KICKED.toString();
    }

    /**
     * Hàm xử lý sự kiên bắn thông tin tạo phòng cho tất cả những người tham gia
     */
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MemberStatusChangedEvent event = (MemberStatusChangedEvent) eventPayload;

        if (targetMemberIds == null || targetMemberIds.isEmpty())
            return;
        for(Long memberId : targetMemberIds){
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
        log.info("Broadcast conversation create to {} members", event.getMemberIds());
    }
}
