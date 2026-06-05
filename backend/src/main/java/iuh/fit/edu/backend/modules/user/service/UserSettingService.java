package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.dto.response.UserProfileResponse;

public interface UserSettingService {
    UserProfileResponse getProfileUser(long id);
}
