package iuh.fit.edu.backend.modules.report.dto.request;

import iuh.fit.edu.backend.modules.report.constant.ReportReason;
import iuh.fit.edu.backend.modules.report.constant.ReportTargetType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload người dùng (web/mobile) gửi lên khi báo cáo một tài khoản hoặc một trang.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CreateReportRequest {
    private ReportTargetType targetType;
    private Long targetId;
    private ReportReason reason;
    private String description;
}
