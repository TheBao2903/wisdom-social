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

import iuh.fit.edu.backend.modules.conversation.dto.request.CreateGroupRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.CreateGroupWithInvitesRequest;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationPreviewResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationSidebarResponse;
import jakarta.transaction.Transactional;

import java.util.List;

public interface ConversationService {



    ConversationResponse createGroup(CreateGroupRequest request, Long creatorId);

    ConversationResponse createGroupWithInvites(CreateGroupWithInvitesRequest request, Long creatorId);

    List<ConversationSidebarResponse> getConversationsByUser(Long userId);

    List<ConversationSidebarResponse> getForwardableConversationsByUser(Long userId);

    ConversationResponse getConversationById(Long conversationId, Long userId);

    void deleteConversationForMe(Long conversationId, Long userId);

    void hideConversationForMe(Long conversationId, Long userId);

    @Transactional
    void markAsRead(Long conversationId, Long userId, String lastMessageId);

    ConversationResponse updateMessageRestriction(Long conversationId, Long requesterId, boolean isRestricted);


    ConversationResponse updateJoinApprovalRequired(Long conversationId, Long requesterId, boolean isRequired);

    ConversationResponse updateGroupImage(Long conversationId, Long requesterId, String imageUrl);


    String getOrGenerateInviteLink(Long conversationId, Long requesterId);


    String resetInviteLink(Long conversationId, Long requesterId);


    void disableInviteLink(Long conversationId, Long requesterId);

    ConversationPreviewResponse previewGroupFromToken(String token, Long userId);


    Object joinGroupFromToken(String token, Long userId, String message);
}
