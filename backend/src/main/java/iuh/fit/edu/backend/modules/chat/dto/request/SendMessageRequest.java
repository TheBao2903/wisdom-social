/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.dto.request;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
@Setter
public class SendMessageRequest {
    private String content;
    private MessageType type;
    private Long conversationId;
    private Long receiverId;
    private String clientMessageId;
    private String replyToId;
    private List<AttachmentRequest> attachments;

    @Data
    public static class AttachmentRequest {
        private String url;
        private String type;
        private String fileName;
        private Long fileSize;
    }
}
