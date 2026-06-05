/*
 * @ (#) .java    1.0       
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service;/*
 * @description
 * @author: Huu Thai
 * @date:   
 * @version: 1.0
 */

import iuh.fit.edu.backend.modules.chat.dto.response.MessageRecalledResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;

import java.time.Instant;
import java.util.List;

public interface MessageCacheService {
    void cacheNewMessage(MessageResponse message);

    void updateMessage(MessageRecalledResponse message);

    void updateMessage(MessageResponse message);

    void addDeletedUserToMessage(String messageId, Long conversationId, Long userId);

    void clearCache(Long conversationId);

    List<MessageResponse> getListMessage(Long conversationId, Instant cursor, int limit);

    void cacheListMessage(Long conversationId, List<MessageResponse> messageResponses, Instant cursor);

    List<MessageResponse> getJumpMessagesFromCache(Long conversationId, String targetMessageId);
}
