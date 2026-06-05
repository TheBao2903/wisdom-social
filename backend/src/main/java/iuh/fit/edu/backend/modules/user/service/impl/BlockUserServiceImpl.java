package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.modules.user.entity.BlockedUser;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.FriendRequest;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import iuh.fit.edu.backend.modules.user.service.BlockUserService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BlockUserServiceImpl implements BlockUserService {
    BlockUserRepository blockUserRepository;

    public BlockUserServiceImpl(BlockUserRepository blockUserRepository) {
        this.blockUserRepository = blockUserRepository;
    }

    @Override
    public List<BlockedUser> getBlockUser(User user) {
        return blockUserRepository.findBlockedUsersByBlocker(user);
    }

    @Override
    public List<BlockedUser> getBlockedByUser(User user) {
        return blockUserRepository.findBlockedUsersByBlocked(user);
    }

    @Override
    public boolean blockUser(BlockedUser blockedUser) {
        if(blockedUser!=null) {
            blockUserRepository.save(blockedUser);
            return true;
        }
        return false;
    }

    @Override
    public boolean cancelBlockUser(BlockedUser blockedUser) {
        if(blockedUser!=null) {
            blockUserRepository.deleteById(blockedUser.getId());
            return true;
        }
        return false;
    }

    @Override
    public BlockedUser getBlockUserByBlockerAndBlocked(FriendRequest friendRequest) {
        return blockUserRepository.findBlockedUserByBlocker_IdAndBlocked_Id(
                friendRequest.getSenderId(),friendRequest.getReceivedId());
    }
}
