package iuh.fit.edu.backend.dto.response.user;

import iuh.fit.edu.backend.constant.Gender;
import lombok.Data;

import java.time.Instant;
import java.time.OffsetDateTime;

@Data
public class UserResponseRegister {
    private String phone;
    private String username;
    private Gender gender;
    private String birthday;
    private OffsetDateTime createdAt;
}
