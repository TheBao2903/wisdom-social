package iuh.fit.edu.backend.modules.user.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "device_settings", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "device_name", "device_type"})
})
@Getter
@Setter
public class DeviceSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "device_name", nullable = false)
    private String deviceName;

    @Column(name = "device_type", nullable = false)
    private String deviceType;

    // ── Theme ──
    @Column(name = "theme_mode")
    private String themeMode; // "light", "dark", "system"

    // ── Notification settings ──
    private Boolean pushEnabled;
    private Boolean likesEnabled;
    private Boolean commentsEnabled;
    private Boolean followsEnabled;
    private Boolean messagesEnabled;
    private Boolean pageUpdatesEnabled;
}
