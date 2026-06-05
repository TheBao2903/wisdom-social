package iuh.fit.edu.backend.modules.chat.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageSearchResult {
    private String messageId;
    private Long conversationId;
    private Long senderId;
    private String senderName;
    private String content;
    private Instant createdAt;
}
