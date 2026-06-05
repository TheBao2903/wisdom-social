/*
 * @ (#) NotificationSetting.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.notification.entity.mariadb;

import iuh.fit.edu.backend.modules.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/*
 * @description: Notification settings entity
 * @author: Huu Thai
 * @date: 17/01/2026
 * @version: 1.0
 */
@Entity
@Table(name = "notification_settings")
@Getter
@Setter
public class NotificationSetting {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    private Boolean messageSoundEnabled;
    private Boolean storyUpdatesEnabled;
}
