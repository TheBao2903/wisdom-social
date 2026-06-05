package iuh.fit.edu.backend.modules.user.dto.response;

import iuh.fit.edu.backend.modules.user.constant.Gender;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class UserResponseRegister {
    private String phone;
    private String username;
    private Gender gender;
    private String birthday;
    private OffsetDateTime createdAt;
}
