package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PinConversationRequest {
    @NotNull(message = "conversationId không được để trống")
    private Long conversationId;
}
