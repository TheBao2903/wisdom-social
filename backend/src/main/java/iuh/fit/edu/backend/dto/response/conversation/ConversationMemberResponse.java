/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.dto.response.conversation;

import lombok.*;

import java.time.Instant;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Data
public class ConversationMemberResponse {
    private Long id;
    private Long userId;
    private String nickname; // Tên trong nhóm
    private String avatar;
    private int unreadCount;
    private Instant clearedAt;
    private String lastReadMessageId; // Mốc tin nhắn đã đọc (watermark)
}
