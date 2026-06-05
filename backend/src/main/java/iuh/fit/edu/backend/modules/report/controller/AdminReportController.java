package iuh.fit.edu.backend.modules.report.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.report.constant.ReportStatus;
import iuh.fit.edu.backend.modules.report.dto.request.HandleReportRequest;
import iuh.fit.edu.backend.modules.report.dto.response.ReportResponse;
import iuh.fit.edu.backend.modules.report.dto.response.ReportStatsResponse;
import iuh.fit.edu.backend.modules.report.service.ReportService;
import iuh.fit.edu.backend.modules.report.service.ReportStream;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Endpoint cho trang quản trị: xem danh sách báo cáo, nhận realtime (SSE) và xử lý báo cáo.
 */
@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
@Slf4j
public class AdminReportController {

    private final ReportService reportService;
    private final ReportStream reportStream;
    private final UserService userService;

    /** Danh sách báo cáo, lọc theo trạng thái (PENDING/RESOLVED/DISMISSED). */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ReportResponse>>> getReports(
            @RequestParam(required = false) ReportStatus status) {
        List<ReportResponse> reports = reportService.getReports(status);
        return ResponseEntity.ok(ApiResponse.success(200, "Reports", reports));
    }

    /** Thống kê số lượng báo cáo theo trạng thái. */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<ReportStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(200, "Report stats", reportService.getStats()));
    }

    /** Luồng SSE đẩy báo cáo mới / cập nhật về trang quản trị theo thời gian thực. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return reportStream.subscribe();
    }

    /** Admin xử lý một báo cáo (RESOLVED / DISMISSED). */
    @PostMapping("/{id}/handle")
    public ResponseEntity<ApiResponse<ReportResponse>> handleReport(
            @PathVariable long id,
            @RequestBody HandleReportRequest request) {
        User admin = userService.getCurrentUser();
        if (admin == null) {
            return ResponseEntity.status(401).body(ApiResponse.error(401, "Cần đăng nhập", null));
        }
        try {
            ReportResponse report = reportService.handleReport(id, admin.getId(), request);
            return ResponseEntity.ok(ApiResponse.success(200, "Đã xử lý báo cáo", report));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Handle report failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(500, "Không thể xử lý báo cáo", null));
        }
    }
}
