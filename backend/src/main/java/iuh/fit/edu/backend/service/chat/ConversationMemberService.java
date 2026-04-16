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

import iuh.fit.edu.backend.domain.entity.mysql.ConversationMember;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import jakarta.transaction.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

import java.util.Map;
import java.util.Set;

public interface ConversationMemberService {
    Map<Long, ConversationMemberResponse> getMembersMap(Long conversationId);

    ConversationMemberResponse getMemberInfo(Long conversationId, Long userId);

    void updateMemberStateInCache(Long conversationId, Long userId, ConversationMember memberEntity);

    @Transactional
    void updateNickname(Long conversationId, Long targetUserId, String newNickname);

    Set<Long> getAllMemberId(Long conversationId);
}
