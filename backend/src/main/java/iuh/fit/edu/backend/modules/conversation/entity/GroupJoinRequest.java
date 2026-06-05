/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.entity;

import iuh.fit.edu.backend.modules.conversation.constant.JoinRequestStatus;
import iuh.fit.edu.backend.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Table(name = "group_join_requests")
@Getter
@Setter
@Entity
public class GroupJoinRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "inviter_id")
    private User inviter; // Người mời (nếu có, null nếu tự xin vào qua link)

    @Enumerated(EnumType.STRING)
    private JoinRequestStatus status = JoinRequestStatus.PENDING;


    private Instant createdAt;
    private Instant processedAt; // Thời điểm được duyệt/từ chối
    private Long processorId;
}
