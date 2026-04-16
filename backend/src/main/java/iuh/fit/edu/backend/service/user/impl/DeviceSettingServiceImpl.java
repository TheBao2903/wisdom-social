package iuh.fit.edu.backend.service.user.impl;

import iuh.fit.edu.backend.domain.entity.mysql.DeviceSetting;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.user.DeviceSettingRequest;
import iuh.fit.edu.backend.dto.response.user.DeviceSettingResponse;
import iuh.fit.edu.backend.repository.mysql.DeviceSettingRepository;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import iuh.fit.edu.backend.service.user.DeviceSettingService;
import org.springframework.stereotype.Service;

@Service
public class DeviceSettingServiceImpl implements DeviceSettingService {

    private final DeviceSettingRepository deviceSettingRepository;
    private final UserRepository userRepository;

    public DeviceSettingServiceImpl(DeviceSettingRepository deviceSettingRepository,
                                   UserRepository userRepository) {
        this.deviceSettingRepository = deviceSettingRepository;
        this.userRepository = userRepository;
    }

    @Override
    public DeviceSettingResponse getDeviceSetting(long userId, String deviceName, String deviceType) {
        return deviceSettingRepository
                .findByUser_IdAndDeviceNameAndDeviceType(userId, deviceName, deviceType)
                .map(this::toResponse)
                .orElse(defaultResponse(userId, deviceName, deviceType));
    }

    @Override
    public DeviceSettingResponse saveDeviceSetting(long userId, DeviceSettingRequest request) {
        DeviceSetting setting = deviceSettingRepository
                .findByUser_IdAndDeviceNameAndDeviceType(userId, request.getDeviceName(), request.getDeviceType())
                .orElseGet(() -> {
                    DeviceSetting ds = new DeviceSetting();
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new RuntimeException("User not found"));
                    ds.setUser(user);
                    ds.setDeviceName(request.getDeviceName());
                    ds.setDeviceType(request.getDeviceType());
                    return ds;
                });

        if (request.getThemeMode() != null) setting.setThemeMode(request.getThemeMode());
        if (request.getPushEnabled() != null) setting.setPushEnabled(request.getPushEnabled());
        if (request.getLikesEnabled() != null) setting.setLikesEnabled(request.getLikesEnabled());
        if (request.getCommentsEnabled() != null) setting.setCommentsEnabled(request.getCommentsEnabled());
        if (request.getFollowsEnabled() != null) setting.setFollowsEnabled(request.getFollowsEnabled());
        if (request.getMessagesEnabled() != null) setting.setMessagesEnabled(request.getMessagesEnabled());
        if (request.getPageUpdatesEnabled() != null) setting.setPageUpdatesEnabled(request.getPageUpdatesEnabled());

        DeviceSetting saved = deviceSettingRepository.save(setting);
        return toResponse(saved);
    }

    private DeviceSettingResponse toResponse(DeviceSetting ds) {
        return DeviceSettingResponse.builder()
                .id(ds.getId())
                .userId(ds.getUser().getId())
                .deviceName(ds.getDeviceName())
                .deviceType(ds.getDeviceType())
                .themeMode(ds.getThemeMode())
                .pushEnabled(ds.getPushEnabled())
                .likesEnabled(ds.getLikesEnabled())
                .commentsEnabled(ds.getCommentsEnabled())
                .followsEnabled(ds.getFollowsEnabled())
                .messagesEnabled(ds.getMessagesEnabled())
                .pageUpdatesEnabled(ds.getPageUpdatesEnabled())
                .build();
    }

    private DeviceSettingResponse defaultResponse(long userId, String deviceName, String deviceType) {
        return DeviceSettingResponse.builder()
                .userId(userId)
                .deviceName(deviceName)
                .deviceType(deviceType)
                .themeMode("system")
                .pushEnabled(true)
                .likesEnabled(true)
                .commentsEnabled(true)
                .followsEnabled(true)
                .messagesEnabled(true)
                .pageUpdatesEnabled(true)
                .build();
    }
}
