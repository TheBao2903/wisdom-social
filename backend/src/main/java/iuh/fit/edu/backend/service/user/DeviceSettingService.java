package iuh.fit.edu.backend.service.user;

import iuh.fit.edu.backend.dto.request.user.DeviceSettingRequest;
import iuh.fit.edu.backend.dto.response.user.DeviceSettingResponse;

public interface DeviceSettingService {
    DeviceSettingResponse getDeviceSetting(long userId, String deviceName, String deviceType);
    DeviceSettingResponse saveDeviceSetting(long userId, DeviceSettingRequest request);
}
