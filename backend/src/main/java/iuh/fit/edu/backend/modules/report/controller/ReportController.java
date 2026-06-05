package iuh.fit.edu.backend.modules.report.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.report.dto.request.CreateReportRequest;
import iuh.fit.edu.backend.modules.report.dto.response.ReportResponse;
import iuh.fit.edu.backend.modules.report.service.ReportService;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint cho người dùng (web/mobile) gửi báo cáo về một tài khoản hoặc một trang.
 */
@RestController
@RequestMapping("/api/report")
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final ReportService reportService;
    private final UserService userService;

    @PostMapping
    public ResponseEntity<ApiResponse<ReportResponse>> createReport(
            @RequestBody CreateReportRequest request) {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error(401, "Bạn cần đăng nhập để báo cáo", null));
        }

        try {
            ReportResponse report = reportService.createReport(currentUser.getId(), request);
            return ResponseEntity.ok(ApiResponse.success(200, "Đã gửi báo cáo", report));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Create report failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(500, "Không thể gửi báo cáo", null));
        }
    }
}
