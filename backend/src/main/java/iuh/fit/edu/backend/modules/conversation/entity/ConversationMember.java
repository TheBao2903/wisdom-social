/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.entity;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.user.entity.Color;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Entity
@Getter
@Setter
@Table(name = "conversation_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"conversation_id", "user_id"})
})
public class ConversationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private boolean isMuted;
    private Long lastReadId;
    private String nickname;

    @Enumerated(EnumType.STRING)
    private MemberRole role;

    @Enumerated(EnumType.STRING)
    private ConversationMemberStatus status;

    @Column(name = "joined_at")
    private Instant joinedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "blocked_at")
    private Instant blockedAt;

    @ManyToOne
    @JoinColumn(name = "blocked_by")
    private User blockedBy;

    // Lưu ID của tin nhắn mới nhất mà người này vừa xem
    private String lastReadMessageId;
    // Số lượng tin nhắn chưa đọc
    @Column(columnDefinition = "int default 0")
    private int unreadCount = 0;

    // Lưu lại tin nhắn cuối cùng đối với trường hợp bị kick/left
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "frozen_last_message")
    private FrozenLastMessage frozenLastMessage;

    // Lưu lại tin nhắn đối với truòng hợp xóa ở 1 phía (chỉ áp dụng với tin nhắn cuối cùng)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "personal_last_message")
    private FrozenLastMessage personalLastMessage;
    // Lưu lại id của tin nhắn mà user vừa xóa 1 phía
    private String hiddenGlobalMessageId;
    // Mốc thời gian xóa cuộc hội thoại
    @Column(name = "cleared_at")
    private Instant clearedAt;

//    // Lưu lại id của tin nhắn khi xóa ở phía member
//    private String hiddenGlobalMessageId;

    @Column(name = "is_hidden")
    private boolean isHidden = false;

    @ManyToOne
    @JoinColumn(name = "color_id")
    private Color color;
}
