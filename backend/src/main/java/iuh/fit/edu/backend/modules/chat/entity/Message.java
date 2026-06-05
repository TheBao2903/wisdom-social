/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.entity;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Document(collection = "messages")
@Getter
@Setter
// Taọ index giúp tăng tốc độ truy vấn message
@CompoundIndexes({
        @CompoundIndex(
                name = "conversation_createdAt_idx",
                def = "{ 'conversation_id': 1, 'created_at': -1 }"
        ),
        @CompoundIndex(
                name = "conversation_sender_client_msg_idx",
                def = "{ 'conversation_id': 1, 'sender_id': 1, 'client_message_id': 1 }",
                unique = true,
                partialFilter = "{ 'client_message_id': { '$exists': true, '$type': 'string' } }"
        )
})
@ToString
public class Message {

    @Id
    private String id; // Mongo ID (ObjectId)
    @Field(name = "message_type")
    @Enumerated(EnumType.STRING)
    private MessageType messageType;
    private String content;
    @Field(name = "created_at")
    private Instant createdAt;
    @Field(name = "modified_at")
    private Instant modifiedAt;
    @Field(name = "conversation_id")
    private Long conversationId;
    @Field(name = "client_message_id")
    private String clientMessageId;
    @Field(name = "poll_id")
    private String pollId;

    private boolean isRecalled = false;

    // Danh sách ID của những người bấm "Xóa ở phía tôi"
    private Set<Long> deletedFor;

    // Tham chiếu tới conversation_user để lấy ra được biệt danh của user
    @Field(name = "sender_id")
    private Long senderId;

    private ReplyInfo replyInfo;
    private List<IconName> iconName;

    private List<MediaAttachment> attachments ;

    @Data
    @Builder
    public static class ReplyInfo {
        private String messageId;
        private Long senderId;
        private MessageType type;
        private String content;
    }
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MediaAttachment {
        private String url;      // Link S3
        private String fileName; // Tên gốc
        private Long fileSize;   // Dung lượng (bytes)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IconName {
        private String name;
        private List<IconUser> user;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IconUser {
        private Long userId;
        private int quantity;
    }
}

