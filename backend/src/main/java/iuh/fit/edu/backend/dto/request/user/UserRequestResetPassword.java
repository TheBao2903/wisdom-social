package iuh.fit.edu.backend.dto.request.user;

import lombok.Data;

import java.time.Instant;

@Data
public class UserRequestResetPassword {
    private String phone;
    private String password;
    private String confirmPassword;
    private String confirmationCode;
    private Instant instant=Instant.now();
}
