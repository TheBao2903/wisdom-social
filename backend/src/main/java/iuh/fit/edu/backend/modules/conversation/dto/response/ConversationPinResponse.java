package iuh.fit.edu.backend.modules.conversation.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class ConversationPinResponse {
    private Long conversationId;
    private Instant pinnedAt;
    private ConversationSidebarResponse conversation;
}
