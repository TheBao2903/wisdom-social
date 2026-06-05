package iuh.fit.edu.backend.modules.user.dto.response;

import iuh.fit.edu.backend.modules.user.constant.Gender;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
@Data
@Builder
public class UserResponseLogin {
    private Long id;
    private String phone;
    private String username;
    private String name;
    private String avatarUrl;
    private String bio;
    private Gender gender;
    private String birthday;
    private Instant createdAt;
    private String token;
    private String refreskToken;
    private String idToken;

    private boolean deletionPending;
    private Long deletionRemainingDays;
    private Instant deletionScheduledFor;
    
    private boolean hasPinCode;
}
