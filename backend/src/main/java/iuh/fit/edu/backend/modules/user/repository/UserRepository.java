/*
 * @ (#) UserRepository.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/*
 * @description
 * @author: Ngoc Hai
 * @date:
 * @version: 1.0
 */
@Repository
public interface UserRepository extends JpaRepository<User,Long> {
    User findByPhone(String phone);
    Optional<User> findByUsername(String username);

    boolean existsUserByUsername(String username);

    List<User> findUsersByUsernameContaining(String username);

    List<User> findByDeletionScheduledForBefore(OffsetDateTime dateTime);
    Page<User> findByIdInAndUsernameContainingIgnoreCase(List<Long> ids, String username, Pageable pageable);

    long countByLockedTrue();
    long countByLastActiveAtAfter(Instant since);
    long countByCreatedAtAfter(OffsetDateTime since);
    List<User> findByCreatedAtAfter(OffsetDateTime since);

    // Lấy id các user đang bị khóa trong tập id cho trước. Dùng để overlay trạng
    // thái khóa TƯƠI lên dữ liệu members (vốn có thể đến từ Redis cache cũ).
    @Query("SELECT u.id FROM User u WHERE u.id IN :ids AND u.locked = true")
    Set<Long> findLockedUserIds(@Param("ids") Set<Long> ids);
}