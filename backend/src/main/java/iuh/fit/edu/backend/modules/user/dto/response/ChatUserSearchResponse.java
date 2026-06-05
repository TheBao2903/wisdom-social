package iuh.fit.edu.backend.modules.user.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ChatUserSearchResponse {
    private Long userId;
    private String name;
    private String username;
    private String phone;
    private String avatarUrl;
    private String friendStatus;
    private long mutualGroupsCount;
    private Long existingDirectConversationId;
    private boolean blocked;
}
