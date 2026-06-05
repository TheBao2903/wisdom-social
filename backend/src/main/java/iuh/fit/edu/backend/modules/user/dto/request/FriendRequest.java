package iuh.fit.edu.backend.modules.user.dto.request;

import lombok.Data;

@Data
public class FriendRequest {
    private long senderId;
    private long receivedId;
}
