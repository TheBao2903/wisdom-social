package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.ActiveToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ActiveTokenRepository extends JpaRepository<ActiveToken, Long> {
    List<ActiveToken> findByUserId(Long userId);
    List<ActiveToken> findByUserIdAndPlatform(Long userId, String platform);

    // @Transactional để derived-delete tự quản transaction, cho phép gọi từ
    // ngữ cảnh không có transaction sẵn (vd loginUser gọi logoutAllDevices).
    @Transactional
    void deleteByUserId(Long userId);

    @Transactional
    void deleteByUserIdAndPlatform(Long userId, String platform);
}
