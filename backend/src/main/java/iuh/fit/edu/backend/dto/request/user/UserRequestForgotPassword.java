package iuh.fit.edu.backend.dto.request.user;

import lombok.Data;

import java.time.Instant;

@Data
public class UserRequestForgotPassword {
    private String phone;
    private Instant instant=Instant.now();
}
