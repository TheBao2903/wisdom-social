package iuh.fit.edu.backend.modules.chat.dto.response;

import java.time.Instant;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConversationMediaItem {
    private String messageId;
    private Long conversationId;
    private Long senderId;
    private String type;
    private String url;
    private String content;
    private String fileName;
    private Long fileSize;
    private Instant createdAt;
}
