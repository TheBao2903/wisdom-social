package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.dto.request.DeviceSettingRequest;
import iuh.fit.edu.backend.modules.user.dto.response.DeviceSettingResponse;

public interface DeviceSettingService {
    DeviceSettingResponse getDeviceSetting(long userId, String deviceName, String deviceType);
    DeviceSettingResponse saveDeviceSetting(long userId, DeviceSettingRequest request);
}
