package iuh.fit.edu.backend.modules.report.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Thống kê nhanh số lượng báo cáo theo trạng thái cho dashboard admin.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReportStatsResponse {
    private long total;
    private long pending;
    private long resolved;
    private long dismissed;
}
