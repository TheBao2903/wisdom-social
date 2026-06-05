package iuh.fit.edu.backend.modules.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "active_tokens")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ActiveToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String accessToken;

    @Column(columnDefinition = "TEXT")
    private String refreshToken;

    @Column(columnDefinition = "TEXT")
    private String idToken;

    // Nền tảng của phiên: "WEB" hoặc "MOBILE". Dùng để chỉ thu hồi phiên cùng
    // nền tảng khi đăng nhập (cho phép 1 web + 1 mobile đăng nhập song song).
    private String platform;

    private OffsetDateTime createdAt;
    private OffsetDateTime expiresAt;
}
