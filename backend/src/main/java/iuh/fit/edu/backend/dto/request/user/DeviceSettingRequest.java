package iuh.fit.edu.backend.dto.request.user;

import lombok.Data;

@Data
public class DeviceSettingRequest {
    private String deviceName;
    private String deviceType;
    private String themeMode;        // "light", "dark", "system"
    private Boolean pushEnabled;
    private Boolean likesEnabled;
    private Boolean commentsEnabled;
    private Boolean followsEnabled;
    private Boolean messagesEnabled;
    private Boolean pageUpdatesEnabled;
}
