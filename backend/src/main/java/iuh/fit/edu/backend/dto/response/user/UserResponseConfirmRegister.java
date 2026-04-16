package iuh.fit.edu.backend.dto.response.user;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class UserResponseConfirmRegister {
    private Instant instant=Instant.now();
    private boolean status;
}
