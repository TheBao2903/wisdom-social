import axiosClient from "../api/axiosClient";

export type ReportTargetType = "USER" | "PAGE";

export type ReportReason =
    | "SPAM"
    | "HARASSMENT"
    | "HATE_SPEECH"
    | "VIOLENCE"
    | "NUDITY"
    | "FALSE_INFORMATION"
    | "SCAM"
    | "IMPERSONATION"
    | "ILLEGAL"
    | "OTHER";

export interface CreateReportRequest {
    targetType: ReportTargetType;
    targetId: number;
    reason: ReportReason;
    description?: string;
}

/** Nhãn tiếng Việt cho từng lý do báo cáo (đồng bộ với backend enum ReportReason). */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
    SPAM: "Spam hoặc lừa đảo",
    HARASSMENT: "Quấy rối hoặc bắt nạt",
    HATE_SPEECH: "Phát ngôn thù ghét",
    VIOLENCE: "Bạo lực hoặc nguy hiểm",
    NUDITY: "Nội dung khiêu dâm / nhạy cảm",
    FALSE_INFORMATION: "Thông tin sai lệch",
    SCAM: "Lừa đảo tài chính",
    IMPERSONATION: "Mạo danh",
    ILLEGAL: "Hàng hoá / hoạt động bất hợp pháp",
    OTHER: "Lý do khác",
};

class ReportService {
    /** Gửi báo cáo về một tài khoản hoặc một trang. Ném lỗi với message từ backend nếu thất bại. */
    async createReport(request: CreateReportRequest): Promise<void> {
        await axiosClient.post("report", request);
    }

    reportUser(targetId: number, reason: ReportReason, description?: string): Promise<void> {
        return this.createReport({ targetType: "USER", targetId, reason, description });
    }

    reportPage(targetId: number, reason: ReportReason, description?: string): Promise<void> {
        return this.createReport({ targetType: "PAGE", targetId, reason, description });
    }
}

export default new ReportService();
