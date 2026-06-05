/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@AllArgsConstructor
@NoArgsConstructor
@Data
public class MessageResponse {
    private String id;
    private Long conversationId;
    private String clientMessageId;
    private String content;
    private MessageType type;
    private Instant createdAt;
    private Long senderId;
    private String pollId;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private PollResponse poll;
    private ReplyInfo replyInfo;
    private boolean isActive;
    @JsonProperty("isRecalled")
    private boolean isRecalled = false;
    private List<MediaAttachmentResponse> attachments;
    private List<IconNameResponse> iconName;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private ConversationResponse conversation;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Boolean newConversation;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Set<Long> deletedFor = new HashSet<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplyInfo {
        private String messageId;
        private Long senderId;
        private MessageType type;
        private String content;
    }
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MediaAttachmentResponse {
        private String url;
        private String type;
        private String fileName;
        private Long fileSize;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IconNameResponse {
        private String name;
        private List<IconUserResponse> user;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IconUserResponse {
        private Long userId;
        private int quantity;
    }

}
