/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.dto.response.conversation;

import iuh.fit.edu.backend.constant.ConversationType;
import iuh.fit.edu.backend.constant.MessageType;
import iuh.fit.edu.backend.domain.entity.mysql.PinnedMessageDetail;
import iuh.fit.edu.backend.dto.response.message.LastMessageResponse;
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
    private Instant updatedAt;
    private int unreadCount;
    private LastMessageResponse lastMessage;
    private List<ConversationMemberResponse> members;
    private List<PinnedMessageDetail> pinnedMessages;
}
