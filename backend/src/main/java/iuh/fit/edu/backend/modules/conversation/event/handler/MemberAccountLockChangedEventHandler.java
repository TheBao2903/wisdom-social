/*
 * @ (#) MemberAccountLockChangedEventHandler.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberAccountLockChangedEvent;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

/*
 * @description
 * Nhận sự kiện khóa/mở khóa tài khoản từ Redis pub/sub và broadcast tới tất cả
 * client đang subscribe danh sách thành viên của hội thoại. FE sẽ cập nhật cờ
 * accountLocked để mask/bỏ mask tên + avatar.
 * @author: Huu Thai
 * @version: 1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberAccountLockChangedEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return MemberAccountLockChangedEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return DomainEventType.MEMBER_ACCOUNT_LOCK_CHANGED.toString();
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        MemberAccountLockChangedEvent event = (MemberAccountLockChangedEvent) eventPayload;

        // 1) Kênh members: cập nhật cho user đang MỞ hội thoại (header, message, ...).
        String membersDestination = "/topic/conversations/" + event.getConversationId() + "/members";
        messagingTemplate.convertAndSend(membersDestination, event);

        // 2) Kênh conversations của từng thành viên khác: cập nhật SIDEBAR realtime
        //    (kể cả khi họ KHÔNG mở hội thoại đó). FE chuyển thành window event.
        if (targetMemberIds != null) {
            for (Long memberId : targetMemberIds) {
                messagingTemplate.convertAndSend(
                        "/topic/user/" + memberId + "/conversations", event);
            }
        }
        log.info("Send account lock change to {} and {} sidebar recipient(s)",
                membersDestination, targetMemberIds == null ? 0 : targetMemberIds.size());
    }
}
