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

import iuh.fit.edu.backend.dto.request.message.SendMessageRequest;
import iuh.fit.edu.backend.dto.request.SendCallMessageRequest;
import iuh.fit.edu.backend.dto.response.CursorResponse;
import iuh.fit.edu.backend.dto.response.message.MessageRecalledResponse;
import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

public interface MessageService {
    MessageResponse sendMessage(SendMessageRequest sendMessageRequest, Long userId);

    MessageResponse sendCallMessage(SendCallMessageRequest sendCallMessageRequest, Long userId);

    MessageRecalledResponse recallMessage(String messageId, Long userId);

    @Transactional
    void deleteMessageForMe(String messageId, Long userId);

    void pinMessage(String messageId, Long userId);

    void unpinMessage(String messageId, Long userId);

    CursorResponse<List<MessageResponse>> getMessagesByConversation(
            Long conversationId,
            Long userId,
            Instant before,
            int limit);

    CursorResponse<List<MessageResponse>> getNewerMessages(
            Long conversationId, Long userId, Instant after, int limit);

    CursorResponse<List<MessageResponse>> jumpToMessage(Long conversationId, String targetMessageId, Long userId);
}
