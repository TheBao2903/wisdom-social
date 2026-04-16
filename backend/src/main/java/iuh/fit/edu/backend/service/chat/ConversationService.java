/*
 * @ (#) .java    1.0       
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.chat;/*
 * @description
 * @author: Huu Thai
 * @date:   
 * @version: 1.0
 */

import iuh.fit.edu.backend.dto.response.conversation.ConversationResponse;
import jakarta.transaction.Transactional;

import java.util.List;

public interface ConversationService {
    List<ConversationResponse> getConversationsByUser(Long userId);
    ConversationResponse getConversationById(Long conversationId, Long userId);

    @Transactional
    void deleteConversationForMe(Long conversationId, Long userId);

    @Transactional
    void markAsRead(Long conversationId, Long userId, String lastMessageId);
}
