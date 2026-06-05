package iuh.fit.edu.backend.modules.conversation.entity;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PinnedMessageDetail {
    private String messageId; // ID của tin nhắn gốc trong MongoDB
    private Long pinnerId;    // ID của người thực hiện thao tác ghim
    private Instant pinnedAt; // Thời gian ghim để sắp xếp
    private Long originalSenderId;
    private String content;
    private MessageType type;
}