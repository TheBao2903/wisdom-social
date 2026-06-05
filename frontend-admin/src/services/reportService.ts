import axiosClient from '../api/axiosClient';
import type {
  Report,
  ReportReason,
  ReportStats,
  ReportStatus,
} from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

/** Nhãn tiếng Việt cho từng lý do báo cáo (đồng bộ với backend enum ReportReason). */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam hoặc lừa đảo',
  HARASSMENT: 'Quấy rối hoặc bắt nạt',
  HATE_SPEECH: 'Phát ngôn thù ghét',
  VIOLENCE: 'Bạo lực hoặc nguy hiểm',
  NUDITY: 'Nội dung khiêu dâm / nhạy cảm',
  FALSE_INFORMATION: 'Thông tin sai lệch',
  SCAM: 'Lừa đảo tài chính',
  IMPERSONATION: 'Mạo danh',
  ILLEGAL: 'Hàng hoá / hoạt động bất hợp pháp',
  OTHER: 'Lý do khác',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Chờ xử lý',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Đã bỏ qua',
};

const reportService = {
  /** Lấy danh sách báo cáo, lọc theo trạng thái (bỏ qua = tất cả). */
  async getReports(status?: ReportStatus): Promise<Report[]> {
    const res = await axiosClient.get('/admin/reports', {
      params: status ? { status } : {},
    });
    const list = unwrap<Report[]>(res);
    return Array.isArray(list) ? list : [];
  },

  async getStats(): Promise<ReportStats> {
    const res = await axiosClient.get('/admin/reports/stats');
    return unwrap<ReportStats>(res);
  },

  /** Admin xử lý báo cáo: RESOLVED hoặc DISMISSED kèm ghi chú. */
  async handleReport(
    id: number,
    status: Exclude<ReportStatus, 'PENDING'>,
    adminNote?: string,
  ): Promise<Report> {
    const res = await axiosClient.post(`/admin/reports/${id}/handle`, {
      status,
      adminNote,
    });
    return unwrap<Report>(res);
  },
};

export default reportService;
