package iuh.fit.edu.backend.modules.user.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendEventPayload {
    private String eventType;
    private Long senderId;
    private Long receiverId;
    private String timestamp;
}
