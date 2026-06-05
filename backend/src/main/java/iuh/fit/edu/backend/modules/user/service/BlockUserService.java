package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.entity.BlockedUser;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.FriendRequest;

import java.util.List;

public interface BlockUserService {
    List<BlockedUser> getBlockUser(User user);
    List<BlockedUser> getBlockedByUser(User user);
    boolean blockUser(BlockedUser blockedUser);
    boolean cancelBlockUser(BlockedUser blockedUser);
    BlockedUser getBlockUserByBlockerAndBlocked(FriendRequest friendRequest);
}
