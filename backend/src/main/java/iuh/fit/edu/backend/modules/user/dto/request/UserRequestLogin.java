package iuh.fit.edu.backend.modules.user.dto.request;

import lombok.Data;

@Data
public class UserRequestLogin {
    private String phone;
    private String password;
    private String deviceType;
    private String deviceName;
    private String ipAddress;
}
