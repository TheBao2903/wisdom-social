package iuh.fit.edu.backend.service.user;

import iuh.fit.edu.backend.dto.response.user.UserProfileResponse;

public interface UserSettingService {
    UserProfileResponse getProfileUser(long id);
}
