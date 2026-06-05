package iuh.fit.edu.backend.modules.user.dto.request;

import lombok.Data;

import java.time.Instant;

@Data
public class UserRequestForgotPassword {
    private String phone;
    private Instant instant=Instant.now();
}
