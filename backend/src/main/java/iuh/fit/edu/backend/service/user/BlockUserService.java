package iuh.fit.edu.backend.service.user;

import iuh.fit.edu.backend.domain.entity.mysql.BlockedUser;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.friend.FriendRequest;

import java.util.List;

public interface BlockUserService {
    List<BlockedUser> getBlockUser(User user);
    List<BlockedUser> getBlockedByUser(User user);
    boolean blockUser(BlockedUser blockedUser);
    boolean cancelBlockUser(BlockedUser blockedUser);
    BlockedUser getBlockUserByBlockerAndBlocked(FriendRequest friendRequest);
}
