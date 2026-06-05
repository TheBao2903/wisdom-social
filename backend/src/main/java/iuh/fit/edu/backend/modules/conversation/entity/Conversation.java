/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.entity;

import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.common.util.convert.PinnedMessagesConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Table(name = "conversations")
@Getter
@Setter
@Entity
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    private ConversationType type;
    @Column(name = "direct_key", unique = true, length = 50)
    private String directKey;
    //    Tên nhóm (null nếu là direct chat)
    private String name;
    //    Avatar nhom
    private String imageUrl;
    private Instant updatedAt;

    // Snapshot cho tin nhan moi nhat
    private String lastMessageId;
    private String lastMessageContent;
    private Instant lastMessageAt;
    @Enumerated(EnumType.STRING)
    private MessageType lastMessageType;
    private Long lastSenderId;
    private String lastSenderName;

    // Bật lên thì chỉ Trưởng/Phó nhóm mới được gửi tin nhắn
    @Column(name = "is_message_restricted", columnDefinition = "boolean default false")
    private boolean isMessageRestricted = false;

    // Bật lên thì ai vào nhóm cũng phải chờ duyệt
    @Column(name = "is_join_approval_required", columnDefinition = "boolean default false")
    private boolean isJoinApprovalRequired = false;

    @Column(name = "invite_token", unique = true)
    private String inviteToken;

    @OneToMany(mappedBy = "conversation")
    private List<ConversationMember> members;

    @Column(name = "pinned_messages", columnDefinition = "JSON")
    @Convert(converter = PinnedMessagesConverter.class)
    private List<PinnedMessageDetail> pinnedMessages = new ArrayList<>();
}

