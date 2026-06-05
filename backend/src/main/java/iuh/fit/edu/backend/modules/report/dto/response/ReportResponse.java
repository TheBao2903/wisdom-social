package iuh.fit.edu.backend.modules.report.dto.response;

import iuh.fit.edu.backend.modules.report.constant.ReportReason;
import iuh.fit.edu.backend.modules.report.constant.ReportStatus;
import iuh.fit.edu.backend.modules.report.constant.ReportTargetType;
import iuh.fit.edu.backend.modules.report.entity.Report;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * Dạng dữ liệu báo cáo trả về cho admin (và dùng làm payload realtime SSE).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReportResponse {
    private Long id;
    private ReportTargetType targetType;
    private Long targetId;
    private String targetName;
    private String targetAvatarUrl;
    private Long reporterId;
    private String reporterName;
    private ReportReason reason;
    private String description;
    private ReportStatus status;
    private String adminNote;
    private Long handledById;
    private String handledByName;
    private OffsetDateTime createdAt;
    private OffsetDateTime handledAt;

    public static ReportResponse from(Report r) {
        return ReportResponse.builder()
                .id(r.getId())
                .targetType(r.getTargetType())
                .targetId(r.getTargetId())
                .targetName(r.getTargetName())
                .targetAvatarUrl(r.getTargetAvatarUrl())
                .reporterId(r.getReporterId())
                .reporterName(r.getReporterName())
                .reason(r.getReason())
                .description(r.getDescription())
                .status(r.getStatus())
                .adminNote(r.getAdminNote())
                .handledById(r.getHandledById())
                .handledByName(r.getHandledByName())
                .createdAt(r.getCreatedAt())
                .handledAt(r.getHandledAt())
                .build();
    }
}
