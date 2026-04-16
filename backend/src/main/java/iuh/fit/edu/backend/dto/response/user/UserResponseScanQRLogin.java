package iuh.fit.edu.backend.dto.response.user;

import iuh.fit.edu.backend.constant.SessionStatus;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
@Data
public class UserResponseScanQRLogin {
    private String seesion_id;
    private SessionStatus status;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    private OffsetDateTime expireAt;

}
