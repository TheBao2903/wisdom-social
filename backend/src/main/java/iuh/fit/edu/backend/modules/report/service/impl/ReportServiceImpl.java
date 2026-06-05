package iuh.fit.edu.backend.modules.report.service.impl;

import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.service.PageService;
import iuh.fit.edu.backend.modules.report.constant.ReportStatus;
import iuh.fit.edu.backend.modules.report.constant.ReportTargetType;
import iuh.fit.edu.backend.modules.report.dto.request.CreateReportRequest;
import iuh.fit.edu.backend.modules.report.dto.request.HandleReportRequest;
import iuh.fit.edu.backend.modules.report.dto.response.ReportResponse;
import iuh.fit.edu.backend.modules.report.dto.response.ReportStatsResponse;
import iuh.fit.edu.backend.modules.report.entity.Report;
import iuh.fit.edu.backend.modules.report.repository.ReportRepository;
import iuh.fit.edu.backend.modules.report.service.ReportService;
import iuh.fit.edu.backend.modules.report.service.ReportStream;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final ReportRepository reportRepository;
    private final ReportStream reportStream;
    private final UserService userService;
    private final PageService pageService;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public ReportResponse createReport(long reporterId, CreateReportRequest request) {
        if (request == null || request.getTargetType() == null
                || request.getTargetId() == null || request.getReason() == null) {
            throw new IllegalArgumentException("Thiếu thông tin báo cáo (loại, đối tượng hoặc lý do).");
        }

        // Không cho tự báo cáo chính mình
        if (request.getTargetType() == ReportTargetType.USER
                && request.getTargetId() == reporterId) {
            throw new IllegalArgumentException("Bạn không thể tự báo cáo chính mình.");
        }

        // Giải quyết tên/ảnh đối tượng để admin xem nhanh, đồng thời xác thực đối tượng tồn tại
        String targetName;
        String targetAvatar = null;
        if (request.getTargetType() == ReportTargetType.USER) {
            User target = userService.findUserById(request.getTargetId());
            if (target == null) throw new IllegalArgumentException("Tài khoản bị báo cáo không tồn tại.");
            targetName = target.getName() != null ? target.getName() : target.getUsername();
            targetAvatar = target.getAvatarUrl();
        } else {
            Page target = pageService.findPageById(request.getTargetId());
            if (target == null) throw new IllegalArgumentException("Trang bị báo cáo không tồn tại.");
            targetName = target.getName();
            targetAvatar = target.getAvatarUrl();
        }

        // Tránh trùng lặp: người dùng đã có báo cáo PENDING cho cùng đối tượng
        boolean duplicated = reportRepository.existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
                reporterId, request.getTargetType(), request.getTargetId(), ReportStatus.PENDING);
        if (duplicated) {
            throw new IllegalStateException("Bạn đã gửi báo cáo cho đối tượng này và đang chờ xử lý.");
        }

        User reporter = userService.findUserById(reporterId);
        String reporterName = reporter != null
                ? (reporter.getName() != null ? reporter.getName() : reporter.getUsername())
                : null;

        Report report = Report.builder()
                .targetType(request.getTargetType())
                .targetId(request.getTargetId())
                .targetName(targetName)
                .targetAvatarUrl(targetAvatar)
                .reporterId(reporterId)
                .reporterName(reporterName)
                .reason(request.getReason())
                .description(request.getDescription())
                .status(ReportStatus.PENDING)
                .createdAt(OffsetDateTime.now())
                .build();

        report = reportRepository.save(report);

        ReportResponse response = ReportResponse.from(report);

        // Realtime: đẩy báo cáo mới về trang quản trị
        try {
            reportStream.broadcastNew(response);
        } catch (Exception e) {
            log.error("Failed to broadcast new report {}: {}", report.getId(), e.getMessage());
        }

        return response;
    }

    @Override
    public List<ReportResponse> getReports(ReportStatus status) {
        List<Report> reports = (status == null)
                ? reportRepository.findAllByOrderByCreatedAtDesc()
                : reportRepository.findByStatusOrderByCreatedAtDesc(status);
        return reports.stream().map(ReportResponse::from).toList();
    }

    @Override
    @Transactional
    public ReportResponse handleReport(long reportId, long adminId, HandleReportRequest request) {
        if (request == null || request.getStatus() == null
                || request.getStatus() == ReportStatus.PENDING) {
            throw new IllegalArgumentException("Trạng thái xử lý không hợp lệ (chỉ RESOLVED hoặc DISMISSED).");
        }

        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy báo cáo."));

        report.setStatus(request.getStatus());
        report.setAdminNote(request.getAdminNote());
        report.setHandledById(adminId);

        User admin = userService.findUserById(adminId);
        report.setHandledByName(admin != null
                ? (admin.getName() != null ? admin.getName() : admin.getUsername())
                : "Admin");
        report.setHandledAt(OffsetDateTime.now());

        report = reportRepository.save(report);
        ReportResponse response = ReportResponse.from(report);

        // Realtime: đồng bộ các tab admin khác
        try {
            reportStream.broadcastUpdated(response);
        } catch (Exception e) {
            log.error("Failed to broadcast updated report {}: {}", report.getId(), e.getMessage());
        }

        // Realtime: thông báo lại cho người báo cáo (chuông thông báo trên web/mobile)
        notifyReporter(report);

        return response;
    }

    @Override
    public ReportStatsResponse getStats() {
        return ReportStatsResponse.builder()
                .total(reportRepository.count())
                .pending(reportRepository.countByStatus(ReportStatus.PENDING))
                .resolved(reportRepository.countByStatus(ReportStatus.RESOLVED))
                .dismissed(reportRepository.countByStatus(ReportStatus.DISMISSED))
                .build();
    }

    /** Gửi thông báo (qua pipeline notification hiện có) cho người báo cáo về kết quả xử lý. */
    private void notifyReporter(Report report) {
        try {
            String targetLabel = report.getTargetType() == ReportTargetType.PAGE ? "trang" : "tài khoản";
            String outcome = report.getStatus() == ReportStatus.RESOLVED
                    ? "đã được xử lý" : "đã được xem xét";
            String content = String.format("Báo cáo của bạn về %s \"%s\" %s.",
                    targetLabel,
                    report.getTargetName() != null ? report.getTargetName() : "",
                    outcome);

            TargetType notifTargetType = report.getTargetType() == ReportTargetType.PAGE
                    ? TargetType.PAGE : TargetType.USER;

            notificationService.createNotification(NotificationEvent.builder()
                    .recipientId(String.valueOf(report.getReporterId()))
                    .type(NotificationType.REPORT_REVIEWED)
                    .targetType(notifTargetType)
                    .targetId(String.valueOf(report.getTargetId()))
                    .content(content)
                    .imageUrl(report.getTargetAvatarUrl())
                    .build());
        } catch (Exception e) {
            log.error("Failed to notify reporter for report {}: {}", report.getId(), e.getMessage());
        }
    }
}
