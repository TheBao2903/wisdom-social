/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberAddedEvent;
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
public class MemberAddedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MemberAddedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MEMBER_ADDED.toString();
    }

    /**
     * Hàm xử lý sự kiên bắn thông tin tạo phòng cho tất cả những người tham gia
     */
    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MemberAddedEvent event = (MemberAddedEvent) eventPayload;

        if (targetMemberIds == null || targetMemberIds.isEmpty())
            return;
        for(Long memberId : targetMemberIds){
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
        log.info("Broadcast conversation update to {} members", event.getMemberIds());
    }
}
