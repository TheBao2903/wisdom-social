package iuh.fit.edu.backend.modules.conversation.dto.response;

import iuh.fit.edu.backend.modules.conversation.entity.Conversation;

public record DirectConversationResolveResult(
        Conversation conversation,
        boolean created
) {
}
