package iuh.fit.edu.backend.modules.chat.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SendCallMessageRequest {
    private Long conversationId;
    private String callType; // VIDEO | AUDIO
    private String status; // calling | ringing | accepted | rejected | ended
    private Long durationSeconds;
}
