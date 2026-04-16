/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.dto.response.message;

import iuh.fit.edu.backend.constant.MessageType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/*
 * @description: DTO chứa thông tin tin nhắn cuối cùng của conversation
 *               Được gửi qua WebSocket tới tất cả members để cập nhật sidebar real-time
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Data
public class LastMessageResponse {

    // Nội dung tin nhắn cuối cùng
    private String lastMessageContent;
    
    // Loại tin nhắn (TEXT, IMAGE, FILE)
    private MessageType lastMessageType;
    
    // ID của người gửi tin nhắn cuối cùng
    private Long lastSenderId;
    
    // Tên của người gửi tin nhắn cuối cùng
    private String lastSenderName;
    
    // Thời điểm gửi tin nhắn cuối cùng
    private Instant lastMessageAt;

    private boolean isRead;
}
