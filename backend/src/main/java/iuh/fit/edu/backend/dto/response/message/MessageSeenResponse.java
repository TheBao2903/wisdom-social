package iuh.fit.edu.backend.dto.response.message;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageSeenResponse {
    private Long conversationId;
    private Long userId; // ID của người VỪA BẤM XEM
    private String lastMessageId; // Mốc ID tin nhắn (Watermark)
    private Instant seenAt;
}