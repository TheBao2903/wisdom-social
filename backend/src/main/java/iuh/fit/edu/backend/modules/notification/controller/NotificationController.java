package iuh.fit.edu.backend.modules.notification.controller;

import iuh.fit.edu.backend.modules.notification.entity.mongodb.Notification;
import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;
    private final UserService userService;

    /**
     * Lấy danh sách thông báo của user hiện tại
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Notification>>> getNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(401)
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập để xem thông báo", null));
            }

            List<Notification> notifications = notificationService.getNotifications(
                    String.valueOf(currentUser.getId()), page, size);
            
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách thông báo thành công", notifications));
        } catch (Exception e) {
            log.error("Error fetching notifications", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy thông báo: " + e.getMessage(), null));
        }
    }

    /**
     * Lấy số lượng thông báo chưa đọc
     */
    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount() {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(401)
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập", null));
            }

            long count = notificationService.getUnreadCount(String.valueOf(currentUser.getId()));
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy số lượng chưa đọc thành công", count));
        } catch (Exception e) {
            log.error("Error getting unread count", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi: " + e.getMessage(), null));
        }
    }

    /**
     * Đánh dấu thông báo là đã đọc
     */
    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable String id) {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(401)
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập", null));
            }

            notificationService.markAsRead(id, String.valueOf(currentUser.getId()));
            return ResponseEntity.ok(ApiResponse.success(200, "Đánh dấu đã đọc thành công", null));
        } catch (Exception e) {
            log.error("Error marking notification as read", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi: " + e.getMessage(), null));
        }
    }

    /**
     * Đánh dấu tất cả thông báo là đã đọc
     */
    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead() {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(401)
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập", null));
            }

            notificationService.markAllAsRead(String.valueOf(currentUser.getId()));
            return ResponseEntity.ok(ApiResponse.success(200, "Đánh dấu tất cả đã đọc thành công", null));
        } catch (Exception e) {
            log.error("Error marking all notifications as read", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi: " + e.getMessage(), null));
        }
    }

    /**
     * Xóa cache thông báo của user hiện tại
     */
    @DeleteMapping("/clear-cache")
    public ResponseEntity<ApiResponse<Void>> clearCache() {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.status(401)
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập", null));
            }

            notificationService.clearCache(String.valueOf(currentUser.getId()));
            return ResponseEntity.ok(ApiResponse.success(200, "Xóa cache thông báo thành công", null));
        } catch (Exception e) {
            log.error("Error clearing notification cache", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi: " + e.getMessage(), null));
        }
    }
}
