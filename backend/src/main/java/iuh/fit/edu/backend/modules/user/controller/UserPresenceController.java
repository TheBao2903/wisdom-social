package iuh.fit.edu.backend.modules.user.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserPresenceService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/status")
@RequiredArgsConstructor
public class UserPresenceController {

    private final UserPresenceService userPresenceService;
    private final UserService userService;

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserStatusResponse>> getUserStatus(@PathVariable Long userId) {
        User currentUser = userService.getCurrentUser();
        // REST dùng để lấy snapshot ban đầu; chỉ bạn bè/self mới được xem presence thật.
        UserStatusResponse status = userPresenceService.getStatusesForViewer(currentUser.getId(), List.of(userId))
                .stream()
                .findFirst()
                .orElse(null);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy trạng thái hoạt động thành công", status));
    }

    @PostMapping("/bulk")
    public ResponseEntity<ApiResponse<List<UserStatusResponse>>> getBulkUserStatus(@RequestBody List<Long> userIds) {
        User currentUser = userService.getCurrentUser();
        // Bulk status giúp chat list/friend list không phải gọi nhiều request nhỏ.
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "Lấy danh sách trạng thái hoạt động thành công",
                userPresenceService.getStatusesForViewer(currentUser.getId(), userIds)
        ));
    }
}
