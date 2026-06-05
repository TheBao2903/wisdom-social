/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.service;/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;

import java.util.Map;

public interface ConversationMemberCacheService {
    Map<Long, ConversationMemberResponse> getMembersMap(Long conversationId);

    ConversationMemberResponse getMemberInfo(Long conversationId, Long userId);

    void saveMembersMap(Long conversationId, Map<Long, ConversationMemberResponse> dbMap);

    void saveMemberInfo(Long conversationId, Long userId, ConversationMemberResponse info);

    void evictConversation(Long conversationId);
}
