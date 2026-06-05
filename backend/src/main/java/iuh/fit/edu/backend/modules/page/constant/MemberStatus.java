package iuh.fit.edu.backend.modules.page.constant;

public enum MemberStatus {
    PENDING,   // Request đang chờ duyệt
    ACTIVE,    // Đã là member
    REMOVED,   // Đã bị xóa khỏi page
    REJECTED   // Request bị từ chối (để track history)
}