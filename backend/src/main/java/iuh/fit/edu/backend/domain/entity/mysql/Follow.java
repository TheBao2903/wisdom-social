/*
 * @ (#) Follow.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.mysql;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/*
 * @description: Follow entity - Theo dõi người dùng, page, group
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Entity
@Getter
@Setter
@Table(name = "follows", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"follower_id", "following_id"})
})
public class Follow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "follower_id")
    private User follower; // Người theo dõi

    @ManyToOne
    @JoinColumn(name = "following_id")
    private User following; // Người được theo dõi

    private LocalDateTime followedAt;
    
    // Notification settings
    private boolean notificationsEnabled; // Bật thông báo cho người này
}
