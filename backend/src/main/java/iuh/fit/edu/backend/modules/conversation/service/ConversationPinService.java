package iuh.fit.edu.backend.modules.conversation.service;

import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationPinResponse;

import java.util.List;

public interface ConversationPinService {
    ConversationPinResponse pinConversation(Long userId, Long conversationId);

    void unpinConversation(Long userId, Long conversationId);

    List<ConversationPinResponse> getPinnedConversations(Long userId);
}
