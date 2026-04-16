package iuh.fit.edu.backend.dto.request.user;

import iuh.fit.edu.backend.constant.Gender;
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
}
