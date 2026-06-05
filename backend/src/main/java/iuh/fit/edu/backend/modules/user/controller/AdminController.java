package iuh.fit.edu.backend.modules.user.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.common.service.security.AccountLockService;
import iuh.fit.edu.backend.modules.story.repository.StoryRepository;
import iuh.fit.edu.backend.modules.user.dto.response.AdminStatsResponse;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.service.AdminStatsService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AccountLockService accountLockService;
    private final AdminStatsService adminStatsService;
    private final StoryRepository storyRepository;
    private final UserService userService;
    private final UserRepository userRepository;

    @PostMapping("/lock/{userId}")
    public ResponseEntity<String> lockUser(@PathVariable Long userId,
                                           @RequestBody Map<String, String> body) {
        String reason = body.getOrDefault("reason", "Admin action");
        accountLockService.adminLock(userId, reason);

        // Kick the user out in real-time if they are currently online:
        // pushes a FORCE_LOGOUT WebSocket event, blacklists their tokens and
        // removes active sessions/devices. On the next login attempt the
        // account-lock check rejects them with "Tài khoản đã bị khóa".
        userRepository.findById(userId).ifPresent(userService::logoutAllDevices);

        return ResponseEntity.ok("User locked successfully");
    }

    @PostMapping("/unlock/{userId}")
    public ResponseEntity<String> unlockUser(@PathVariable Long userId) {
        accountLockService.adminUnlock(userId);
        return ResponseEntity.ok("User unlocked successfully");
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminStatsResponse>> getAdminStats() {
        AdminStatsResponse stats = adminStatsService.getStats();
        return ResponseEntity.ok(ApiResponse.success(200, "Admin stats", stats));
    }

    @DeleteMapping("/stories/{storyId}")
    public ResponseEntity<ApiResponse<String>> deleteStory(@PathVariable String storyId) {
        storyRepository.deleteById(storyId);
        return ResponseEntity.ok(ApiResponse.success(200, "Story deleted by admin", null));
    }
}
