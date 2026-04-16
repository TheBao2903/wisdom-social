package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.BlockedUser;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BlockUserRepository extends JpaRepository<BlockedUser,Long> {
    List<BlockedUser> findBlockedUsersByBlocker(User blocker);

    BlockedUser findBlockedUserByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    BlockedUser findBlockedUserByBlockerPage_IdAndBlocked_Id(Long blockerPageId, Long blockedId);

    List<BlockedUser> findBlockedUsersByBlocked(User blocked);
}
