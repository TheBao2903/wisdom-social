package iuh.fit.edu.backend.modules.user.dto.request;

import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.user.constant.Gender;
import lombok.Data;

@Data
public class UserRequestUpdate {
    private String name;
    private Gender gender;
    private String backgroundUrl;
    private String avatarUrl;
    private String bio;
    private String username;
    private String birthday;
    private PrivacyType privacyProfile;
}
