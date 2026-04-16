package iuh.fit.edu.backend.dto.response.user;

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
