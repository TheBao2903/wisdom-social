package iuh.fit.edu.backend.modules.conversation.entity;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FrozenLastMessage {
    private String content;
    private Long senderId;
    private String senderName;
    private MessageType type;
    private Instant time;
}