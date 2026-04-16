/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.mysql;

import iuh.fit.edu.backend.constant.ConversationType;
import iuh.fit.edu.backend.constant.MessageType;
import iuh.fit.edu.backend.util.PinnedMessagesConverter;
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
//    Tên nhóm (null nếu là direct chat)
    private String name;
//    Avatar nhom
    private String imageUrl;
    private Instant updatedAt;

    // Snapshot cho tin nhan moi nhat
    private String lastMessageContent;
    private Instant lastMessageAt;
    @Enumerated(EnumType.STRING)
    private MessageType lastMessageType;
    private Long lastSenderId;

    @OneToMany(mappedBy = "conversation")
    private List<ConversationMember> members;

    @Column(name = "pinned_messages", columnDefinition = "JSON")
    @Convert(converter = PinnedMessagesConverter.class)
    private List<PinnedMessageDetail> pinnedMessages = new ArrayList<>();
}
