package iuh.fit.edu.backend.modules.user.controller;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.DeviceSettingRequest;
import iuh.fit.edu.backend.modules.user.dto.response.DeviceSettingResponse;
import iuh.fit.edu.backend.modules.user.service.DeviceSettingService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import iuh.fit.edu.backend.common.util.anotation.ApiMessage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/device-settings")
public class DeviceSettingController {

    private final DeviceSettingService deviceSettingService;
    private final UserService userService;

    public DeviceSettingController(DeviceSettingService deviceSettingService, UserService userService) {
        this.deviceSettingService = deviceSettingService;
        this.userService = userService;
    }

    @GetMapping
    @ApiMessage("Get device setting")
    public ResponseEntity<DeviceSettingResponse> getDeviceSetting(
            @RequestParam String deviceName,
            @RequestParam String deviceType) {
        User currentUser = userService.getCurrentUser();
        DeviceSettingResponse response = deviceSettingService.getDeviceSetting(
                currentUser.getId(), deviceName, deviceType);
        return ResponseEntity.ok(response);
    }

    @PutMapping
    @ApiMessage("Save device setting")
    public ResponseEntity<DeviceSettingResponse> saveDeviceSetting(
            @RequestBody DeviceSettingRequest request) {
        User currentUser = userService.getCurrentUser();
        DeviceSettingResponse response = deviceSettingService.saveDeviceSetting(
                currentUser.getId(), request);
        return ResponseEntity.ok(response);
    }
}
