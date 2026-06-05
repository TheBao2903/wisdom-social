package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.UserSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserSettingRepository extends JpaRepository<UserSetting,Long> {
}
