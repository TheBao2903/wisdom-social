/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.user.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.page.entity.PageFollow;
import iuh.fit.edu.backend.modules.page.entity.PageLike;
import iuh.fit.edu.backend.modules.page.entity.PageMember;
import iuh.fit.edu.backend.modules.notification.entity.mariadb.NotificationSetting;
import iuh.fit.edu.backend.modules.user.constant.Gender;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String phone;
    private String name;

    @Column(unique = true)
    private String username;
    private String avatarUrl;
    private String birthday;
    private String bio;
    private Gender gender;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    private boolean confirmUseAI = false;

    private Instant lastActiveAt;

    // Account locking
    @Builder.Default
    private boolean locked = false;
    private OffsetDateTime lockedAt;
    private String lockReason;
    private OffsetDateTime lockedUntil;
    private String lockedBy;

    // Account deletion
    private OffsetDateTime deletionRequestedAt;
    private OffsetDateTime deletionScheduledFor;

    // 2FA PIN code
    @JsonIgnore
    private String pinCode;

    @JsonProperty("hasPinCode")
    public boolean hasPinCode() {
        return this.pinCode != null && !this.pinCode.isEmpty();
    }

    // Vai trò lấy từ Cognito groups (ADMIN/USER), không lưu DB.
    // Frontend dùng để phân quyền truy cập (chỉ ADMIN mới vào được trang quản trị).
    @Transient
    private List<String> roles;

    @OneToMany(mappedBy = "user")
    @JsonIgnore
    private List<Device> devices;


    @JsonIgnore
    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private UserSetting userSetting;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    @JsonIgnore
    private NotificationSetting notificationSetting;

    @JsonIgnore
    @OneToMany(mappedBy = "user")
    private List<PageMember> pageMembers;

    @OneToMany(mappedBy = "user")
    @JsonIgnore
    private List<PageFollow> pageFollows;


    @OneToMany(mappedBy = "user")
    @JsonIgnore
    private List<PageLike> pageLikes;
}
