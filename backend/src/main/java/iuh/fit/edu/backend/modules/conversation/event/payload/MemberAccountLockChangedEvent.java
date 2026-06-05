/*
 * @ (#) MemberAccountLockChangedEvent.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

import java.util.Set;

/*
 * @description
 * Sự kiện realtime báo cho các thành viên đang xem một hội thoại biết rằng tài khoản
 * của một thành viên vừa bị khóa/mở khóa, để FE mask (hoặc bỏ mask) tên/avatar.
 * KHÔNG liên quan tới ConversationMemberStatus.
 * @author: Huu Thai
 * @version: 1.0
 */
@Getter
public class MemberAccountLockChangedEvent {
    private final Long conversationId;
    private final Long userId;          // ID của user bị khóa/mở khóa
    private final boolean accountLocked; // true = đang bị khóa, false = đã mở khóa
    // Danh sách user cần cập nhật SIDEBAR (các thành viên khác của hội thoại).
    // Dùng làm targetMemberIds để fan-out tới /topic/user/{id}/conversations.
    // Có thể null/empty nếu không cần cập nhật sidebar.
    private final Set<Long> recipientUserIds;
    private final DomainEventType domainEventType = DomainEventType.MEMBER_ACCOUNT_LOCK_CHANGED;

    @JsonCreator
    public MemberAccountLockChangedEvent(
            @JsonProperty("conversationId") Long conversationId,
            @JsonProperty("userId") Long userId,
            @JsonProperty("accountLocked") boolean accountLocked,
            @JsonProperty("recipientUserIds") Set<Long> recipientUserIds) {
        this.conversationId = conversationId;
        this.userId = userId;
        this.accountLocked = accountLocked;
        this.recipientUserIds = recipientUserIds;
    }
}
