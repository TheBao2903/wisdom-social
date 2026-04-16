package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.Friend;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FriendRepository extends JpaRepository<Friend,Long> {
    Friend findFriendByFriendAndUser(User friend, User user);
    Friend findFriendByUserAndFriend(User user, User friend);
    List<Friend> findFriendsByUser(User user);

    List<Friend> findFriendsByFriend(User friend);
}
