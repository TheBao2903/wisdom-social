package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ResolveDirectConversationRequest {
    @NotNull
    private Long receiverId;
}
