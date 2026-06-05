package iuh.fit.edu.backend.modules.user.dto.request;

import lombok.Data;

@Data
public class UserRequestQRLogin {
    private String session_id;
    private String deviceType;
    private String deviceName;
    private String ipAddress;
}
