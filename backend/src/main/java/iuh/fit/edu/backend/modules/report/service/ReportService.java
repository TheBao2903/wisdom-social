package iuh.fit.edu.backend.modules.report.service;

import iuh.fit.edu.backend.modules.report.constant.ReportStatus;
import iuh.fit.edu.backend.modules.report.dto.request.CreateReportRequest;
import iuh.fit.edu.backend.modules.report.dto.request.HandleReportRequest;
import iuh.fit.edu.backend.modules.report.dto.response.ReportResponse;
import iuh.fit.edu.backend.modules.report.dto.response.ReportStatsResponse;

import java.util.List;

public interface ReportService {

    /** Người dùng gửi báo cáo về một tài khoản hoặc một trang. */
    ReportResponse createReport(long reporterId, CreateReportRequest request);

    /** Admin lấy danh sách báo cáo, lọc theo trạng thái (null = tất cả). */
    List<ReportResponse> getReports(ReportStatus status);

    /** Admin xử lý báo cáo (RESOLVED / DISMISSED) và thông báo lại cho người báo cáo. */
    ReportResponse handleReport(long reportId, long adminId, HandleReportRequest request);

    /** Thống kê số lượng theo trạng thái cho dashboard. */
    ReportStatsResponse getStats();
}
