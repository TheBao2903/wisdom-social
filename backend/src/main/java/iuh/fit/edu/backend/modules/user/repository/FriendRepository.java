package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.Friend;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FriendRepository extends JpaRepository<Friend,Long> {
    Friend findFriendByFriendAndUser(User friend, User user);
    Friend findFriendByUserAndFriend(User user, User friend);
    List<Friend> findFriendsByUser(User user);

    List<Friend> findFriendsByFriend(User friend);

    @Query("""
        SELECT CASE WHEN f.user.id = :userId THEN f.friend.id ELSE f.user.id END
        FROM Friend f
        WHERE (f.user.id = :userId OR f.friend.id = :userId)
          AND f.status = iuh.fit.edu.backend.modules.user.constant.FriendStatus.ACCEPTED
        """)
    List<Long> findAcceptedFriendIdsQuery(@Param("userId") Long userId);

    default List<Long> findAcceptedFriendIds(Long userId, int acceptedStatus) {
        return findAcceptedFriendIdsQuery(userId);
    }

    @Query("""
        SELECT COUNT(f) FROM Friend f
        WHERE ((f.user.id = :userId1 AND f.friend.id = :userId2) OR (f.user.id = :userId2 AND f.friend.id = :userId1))
          AND f.status = iuh.fit.edu.backend.modules.user.constant.FriendStatus.ACCEPTED
        """)
    Long countAcceptedFriendship(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    default boolean existsAcceptedFriendship(Long userId1, Long userId2, int acceptedStatus) {
        Long count = countAcceptedFriendship(userId1, userId2);
        return count != null && count > 0;
    }
}
