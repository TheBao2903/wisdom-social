package iuh.fit.edu.backend.modules.user.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockEventPayload {
    private String eventType;
    private Long blockerId;
    private Long blockedId;
    private String timestamp;
}
