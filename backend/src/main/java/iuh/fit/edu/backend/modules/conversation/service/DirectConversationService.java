package iuh.fit.edu.backend.modules.conversation.service;

import iuh.fit.edu.backend.modules.conversation.dto.response.DirectConversationResolveResult;

public interface DirectConversationService {
    DirectConversationResolveResult getOrCreateDirectConversation(Long senderId, Long receiverId);

    String buildDirectKey(Long userId1, Long userId2);
}
