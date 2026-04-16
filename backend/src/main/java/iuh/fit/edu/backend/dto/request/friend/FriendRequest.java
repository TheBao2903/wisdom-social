package iuh.fit.edu.backend.dto.request.friend;

import lombok.Data;

@Data
public class FriendRequest {
    private long senderId;
    private long receivedId;
}
