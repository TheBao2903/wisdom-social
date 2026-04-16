/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

import iuh.fit.edu.backend.constant.MessageType;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Document(collection = "messages")
@Getter
@Setter
// Taọ index giúp tăng tốc độ truy vấn message
@CompoundIndex(
        name = "conversation_createdAt_idx",
        def = "{ 'conversation_id': 1, 'created_at': -1 }"
)
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

    private boolean isRecalled = false;

    // Danh sách ID của những người bấm "Xóa ở phía tôi"
    private Set<Long> deletedFor;

    // Tham chiếu tới conversation_user để lấy ra được biệt danh của user
    @Field(name = "sender_id")
    private Long senderId;

    private ReplyInfo replyInfo;
    private IconName iconName;

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
}


class IconName{
    private  String name;
    private ArrayList<IconUser> user;
}
class  IconUser{
    private Long userId;
    private int quantity;
}

