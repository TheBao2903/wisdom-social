package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.BlockedUser;
import iuh.fit.edu.backend.modules.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface BlockUserRepository extends JpaRepository<BlockedUser,Long> {
    List<BlockedUser> findBlockedUsersByBlocker(User blocker);

    BlockedUser findBlockedUserByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    BlockedUser findBlockedUserByBlockerPage_IdAndBlocked_Id(Long blockerPageId, Long blockedId);

    List<BlockedUser> findBlockedUsersByBlocked(User blocked);

    boolean existsByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    List<BlockedUser> findByBlocker_IdAndBlocked_IdIn(Long blockerId, Collection<Long> blockedIds);

    List<BlockedUser> findByBlocked_IdAndBlocker_IdIn(Long blockedId, Collection<Long> blockerIds);
}
