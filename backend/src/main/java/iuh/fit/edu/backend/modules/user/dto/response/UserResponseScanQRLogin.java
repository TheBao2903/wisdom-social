package iuh.fit.edu.backend.modules.user.dto.response;

import iuh.fit.edu.backend.modules.user.constant.SessionStatus;
import iuh.fit.edu.backend.modules.user.entity.User;
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
