package iuh.fit.edu.backend.modules.report.constant;

/**
 * Trạng thái xử lý của một báo cáo.
 * PENDING   - chờ admin xử lý
 * RESOLVED  - admin đã xác nhận và xử lý (đã có hành động)
 * DISMISSED - admin đã bỏ qua (không vi phạm)
 */
public enum ReportStatus {
    PENDING,
    RESOLVED,
    DISMISSED
}
