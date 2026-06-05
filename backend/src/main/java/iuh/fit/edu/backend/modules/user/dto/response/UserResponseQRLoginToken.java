package iuh.fit.edu.backend.modules.user.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class UserResponseQRLoginToken {
    private String accessToken;
    private String refreshToken;
}
