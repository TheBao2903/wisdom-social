package iuh.fit.edu.backend.modules.conversation.dto.response;

import iuh.fit.edu.backend.modules.conversation.constant.JoinRequestStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class JoinRequestResponse {
    private Long id;
    private Long conversationId;
    private Long userId;
    private String userName;
    private String userAvatar;
    private Long inviterId;
    private String inviterName;
    private JoinRequestStatus status;
    private String content;
    private Instant createdAt;
}