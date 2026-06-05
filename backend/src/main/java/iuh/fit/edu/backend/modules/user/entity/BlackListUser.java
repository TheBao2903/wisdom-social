package iuh.fit.edu.backend.modules.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import lombok.NoArgsConstructor;


@Table(name = "black_list_users")
@Entity
@NoArgsConstructor
@Data
@Builder
@AllArgsConstructor
public class BlackListUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(columnDefinition = "TEXT")
    private String idToken;
    @Column(columnDefinition = "TEXT")
    private String refreshToken;

    private Long userId;
}
