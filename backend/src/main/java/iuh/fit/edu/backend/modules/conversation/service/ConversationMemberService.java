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

import java.util.Map;
import java.util.List;
import java.util.Set;

import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberWithInvitesRequest;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import jakarta.transaction.Transactional;

public interface ConversationMemberService {
    Map<Long, ConversationMemberResponse> getMembersMap(Long conversationId);

    ConversationMemberResponse getMemberInfo(Long conversationId, Long userId);


    ConversationResponse addMembers(Long conversationId, AddMemberRequest request, Long inviterId);

    ConversationResponse addMembersWithInvites(Long conversationId, AddMemberWithInvitesRequest request, Long inviterId);

    ConversationResponse joinByInviteLink(Long conversationId, Long userId);

    @org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
    ConversationResponse leaveGroup(Long conversationId, Long userId);

    @org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
    ConversationResponse kickMember(Long conversationId, Long targetId, Long requesterId);

    List<ConversationMemberResponse> getBlockedMembers(Long conversationId, Long requesterId);

    ConversationResponse blockMember(Long conversationId, Long targetId, Long requesterId);

    ConversationResponse unblockMember(Long conversationId, Long targetId, Long requesterId);

    void updateMemberStateInCache(Long conversationId, Long userId, ConversationMember memberEntity);

    @Transactional
    void updateNickname(Long conversationId, Long targetUserId, String newNickname);

    Set<Long> getAllMemberId(Long conversationId);

    ConversationResponse updateMemberRole(Long conversationId, Long targetId, Long requesterId, MemberRole newRole);

    void disbandGroup(Long conversationId, Long userId);
}
