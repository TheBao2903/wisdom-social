package iuh.fit.edu.backend.domain.entity.mysql;

import iuh.fit.edu.backend.constant.SessionStatus;
import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Entity
@Table(name = "sessions")
public class Session {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String seesion_id;
    private SessionStatus status;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private OffsetDateTime expireAt;
}
