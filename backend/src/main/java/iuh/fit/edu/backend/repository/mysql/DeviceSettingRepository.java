package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.DeviceSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeviceSettingRepository extends JpaRepository<DeviceSetting, Long> {
    Optional<DeviceSetting> findByUser_IdAndDeviceNameAndDeviceType(long userId, String deviceName, String deviceType);
}
