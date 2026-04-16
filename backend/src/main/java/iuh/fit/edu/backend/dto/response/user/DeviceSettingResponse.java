package iuh.fit.edu.backend.dto.response.user;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DeviceSettingResponse {
    private Long id;
    private long userId;
    private String deviceName;
    private String deviceType;
    private String themeMode;
    private Boolean pushEnabled;
    private Boolean likesEnabled;
    private Boolean commentsEnabled;
    private Boolean followsEnabled;
    private Boolean messagesEnabled;
    private Boolean pageUpdatesEnabled;
}
