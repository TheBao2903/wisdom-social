package iuh.fit.edu.backend.modules.report.dto.request;

import iuh.fit.edu.backend.modules.report.constant.ReportStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload admin gửi lên khi xử lý một báo cáo.
 * status chỉ nên là RESOLVED hoặc DISMISSED.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class HandleReportRequest {
    private ReportStatus status;
    private String adminNote;
}
