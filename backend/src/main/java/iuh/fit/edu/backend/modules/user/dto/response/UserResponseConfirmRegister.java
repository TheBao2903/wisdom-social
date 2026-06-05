package iuh.fit.edu.backend.modules.user.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class UserResponseConfirmRegister {
    private Instant instant=Instant.now();
    private boolean status;
}
