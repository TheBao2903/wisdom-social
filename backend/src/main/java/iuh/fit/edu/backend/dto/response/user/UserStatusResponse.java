package iuh.fit.edu.backend.dto.response.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserStatusResponse {
    private Long userId;
    private boolean isOnline;
    private Instant lastActiveAt; // Sẽ null nếu đang online, có giá trị nếu offline
}