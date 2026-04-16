/*
 * @ (#) Friend.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.mysql;

import iuh.fit.edu.backend.constant.FriendStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/*
 * @description: Friend entity - Quản lý kết bạn
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Entity
@Getter
@Setter
@Table(name = "friends", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "friend_id"})
}, indexes = {
        @Index(name = "idx_user_status", columnList = "user_id, status"),
        @Index(name = "idx_friend_status", columnList = "friend_id, status")
})
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Friend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user; // Người gửi lời mời kết bạn

    @ManyToOne
    @JoinColumn(name = "friend_id")
    private User friend; // Người nhận lời mời kết bạn

    private FriendStatus status;
    private LocalDateTime friendAt;
}