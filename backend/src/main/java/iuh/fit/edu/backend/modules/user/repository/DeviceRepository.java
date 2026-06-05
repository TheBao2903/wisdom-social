package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {
    // @Transactional để derived-delete tự quản transaction khi được gọi ngoài
    // ngữ cảnh transaction (vd single-session logout lúc đăng nhập).
    @Transactional
    void deleteDeviceByUser_Id(Long userId);
}
