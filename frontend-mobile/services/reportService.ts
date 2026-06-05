import apiClient from "@/api/apiClient";

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

export interface CreateReportPayload {
    targetType: ReportTargetType;
    targetId: number;
    reason: ReportReason;
    description?: string;
}

/** Nhãn tiếng Việt cho từng lý do (đồng bộ với backend enum ReportReason). */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
    { value: "SPAM", label: "Spam hoặc lừa đảo" },
    { value: "HARASSMENT", label: "Quấy rối hoặc bắt nạt" },
    { value: "HATE_SPEECH", label: "Phát ngôn thù ghét" },
    { value: "VIOLENCE", label: "Bạo lực hoặc nguy hiểm" },
    { value: "NUDITY", label: "Nội dung khiêu dâm / nhạy cảm" },
    { value: "FALSE_INFORMATION", label: "Thông tin sai lệch" },
    { value: "SCAM", label: "Lừa đảo tài chính" },
    { value: "IMPERSONATION", label: "Mạo danh" },
    { value: "ILLEGAL", label: "Hàng hoá / hoạt động bất hợp pháp" },
    { value: "OTHER", label: "Lý do khác" },
];

class ReportService {
    /**
     * Gửi báo cáo về một tài khoản hoặc một trang.
     * Trả về { ok, message } để UI hiển thị thông báo phù hợp.
     */
    async createReport(
        payload: CreateReportPayload,
    ): Promise<{ ok: boolean; message: string }> {
        try {
            await apiClient.post("/report", payload);
            return { ok: true, message: "Đã gửi báo cáo. Cảm ơn bạn đã phản hồi!" };
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                "Không thể gửi báo cáo. Vui lòng thử lại.";
            return { ok: false, message };
        }
    }

    reportUser(targetId: number, reason: ReportReason, description?: string) {
        return this.createReport({ targetType: "USER", targetId, reason, description });
    }

    reportPage(targetId: number, reason: ReportReason, description?: string) {
        return this.createReport({ targetType: "PAGE", targetId, reason, description });
    }
}

export default new ReportService();
