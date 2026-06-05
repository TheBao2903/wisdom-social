package iuh.fit.edu.backend.modules.report.constant;

/**
 * Lý do báo cáo (bắt buộc khi gửi báo cáo).
 * Giá trị enum được dùng chung giữa web, mobile và admin để hiển thị nhãn tiếng Việt.
 */
public enum ReportReason {
    SPAM,                // Spam hoặc lừa đảo
    HARASSMENT,          // Quấy rối hoặc bắt nạt
    HATE_SPEECH,         // Phát ngôn thù ghét
    VIOLENCE,            // Bạo lực hoặc nguy hiểm
    NUDITY,              // Nội dung khiêu dâm / nhạy cảm
    FALSE_INFORMATION,   // Thông tin sai lệch
    SCAM,                // Lừa đảo tài chính
    IMPERSONATION,       // Mạo danh
    ILLEGAL,             // Hàng hoá / hoạt động bất hợp pháp
    OTHER                // Lý do khác (kèm mô tả)
}
