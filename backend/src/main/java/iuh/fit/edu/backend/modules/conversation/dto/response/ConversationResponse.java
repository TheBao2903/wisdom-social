/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.entity.PinnedMessageDetail;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.LastMessageResponse;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Data
public class ConversationResponse {
    private Long id;
    private String name;
    private ConversationType type;
    private String imageUrl;
    // Với hội thoại DIRECT: đối phương có đang bị khóa tài khoản không (User.locked).
    // Mặc định false -> backward-compatible với client cũ.
    private boolean directPartnerLocked;
    private boolean directBlockedByMe;
    private boolean directBlockedMe;
    private Instant updatedAt;
    private int unreadCount;
    private LastMessageResponse lastMessage;
    @JsonProperty("isMessageRestricted")
    private boolean isMessageRestricted;
    @JsonProperty("isJoinApprovalRequired")
    private boolean isJoinApprovalRequired;
     private String inviteToken;
    private List<ConversationMemberResponse> members;
    private List<PinnedMessageDetail> pinnedMessages;
    private List<JoinRequestResponse> pendingRequests;
}

