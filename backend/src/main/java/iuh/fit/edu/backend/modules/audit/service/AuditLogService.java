/*
 * @ (#) AuditLogService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.audit.service;

import iuh.fit.edu.backend.modules.audit.entity.AuditLog;
import iuh.fit.edu.backend.modules.audit.repository.AuditLogRepository;
import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.repository.PageRepository;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * @description Ghi và truy vấn nhật ký hành động (audit log).
 * @author: Audit Log
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final PageRepository pageRepository;
    private final AuditLogStream auditLogStream;

    /**
     * Chỉ bỏ qua chính endpoint audit-log (đọc + stream) để tránh vòng lặp tự
     * khuếch đại. Mọi API khác — kể cả GET — đều được ghi log.
     */
    private static final Pattern[] IGNORE = {
            Pattern.compile("/admin/audit-logs"),
            // Luồng SSE báo cáo giữ kết nối lâu, không cần ghi log
            Pattern.compile("/admin/reports/stream"),
    };

    /* ----- Kết quả ánh xạ hành động ----- */
    public record ActionInfo(String action, String category, String description,
                             String targetType, String targetId) {}

    private interface Builder {
        ActionInfo build(Matcher m);
    }

    private record Rule(String method, Pattern pattern, Builder builder) {}

    /** Bảng ánh xạ method + path -> hành động có ý nghĩa (đồng bộ với frontend-admin). */
    private static final List<Rule> RULES = List.of(
            // AUTH
            rule("POST", "/auth/login$", m -> new ActionInfo("LOGIN", "AUTH", "Đăng nhập", null, null)),
            rule("POST", "/auth/logout$", m -> new ActionInfo("LOGOUT", "AUTH", "Đăng xuất", null, null)),
            rule("POST", "/auth/register$", m -> new ActionInfo("REGISTER", "AUTH", "Đăng ký tài khoản", null, null)),
            rule("POST", "/auth/reset-password$", m -> new ActionInfo("RESET_PASSWORD", "AUTH", "Đặt lại mật khẩu", null, null)),
            // USER / ADMIN
            rule("POST", "/admin/lock/(\\w+)", m -> new ActionInfo("LOCK_USER", "USER", "Khoá tài khoản người dùng", "USER", m.group(1))),
            rule("POST", "/admin/unlock/(\\w+)", m -> new ActionInfo("UNLOCK_USER", "USER", "Mở khoá tài khoản người dùng", "USER", m.group(1))),
            rule("DELETE", "/auth/users/(\\w+)", m -> new ActionInfo("DELETE_USER", "USER", "Xoá tài khoản người dùng", "USER", m.group(1))),
            rule("PUT", "/auth/users/(\\w+)", m -> new ActionInfo("UPDATE_USER", "USER", "Cập nhật thông tin người dùng", "USER", m.group(1))),
            // FRIEND
            rule("POST", "/friends/request", m -> new ActionInfo("FRIEND_REQUEST", "USER", "Gửi lời mời kết bạn", "USER", null)),
            rule("POST", "/friends/accept", m -> new ActionInfo("FRIEND_ACCEPT", "USER", "Chấp nhận kết bạn", "USER", null)),
            rule("POST", "/friends/block", m -> new ActionInfo("BLOCK_USER", "USER", "Chặn người dùng", "USER", null)),
            // PAGE
            rule("DELETE", "/page/delete/(\\w+)", m -> new ActionInfo("DELETE_PAGE", "PAGE", "Xoá trang", "PAGE", m.group(1))),
            rule("POST", "/page/create", m -> new ActionInfo("CREATE_PAGE", "PAGE", "Tạo trang", "PAGE", null)),
            rule("POST", "/page-member/approve-join$", m -> new ActionInfo("APPROVE_MEMBER", "PAGE", "Duyệt yêu cầu tham gia trang", "PAGE", null)),
            rule("POST", "/page-member/reject-join$", m -> new ActionInfo("REJECT_MEMBER", "PAGE", "Từ chối yêu cầu tham gia trang", "PAGE", null)),
            rule("POST", "/page-member/block$", m -> new ActionInfo("BLOCK_MEMBER", "PAGE", "Chặn thành viên trang", "PAGE", null)),
            rule("POST", "/page-member/cancel-block$", m -> new ActionInfo("UNBLOCK_MEMBER", "PAGE", "Bỏ chặn thành viên trang", "PAGE", null)),
            rule("POST", "/page-member/delete$", m -> new ActionInfo("REMOVE_MEMBER", "PAGE", "Xoá thành viên khỏi trang", "PAGE", null)),
            rule("POST", "/page-member/authorize$", m -> new ActionInfo("AUTHORIZE_MEMBER", "PAGE", "Phân quyền thành viên trang", "PAGE", null)),
            rule("POST", "/page/post/approve$", m -> new ActionInfo("APPROVE_PAGE_POST", "PAGE", "Duyệt bài đăng trên trang", "POST", null)),
            rule("POST", "/page/post/remove$", m -> new ActionInfo("REMOVE_PAGE_POST", "PAGE", "Gỡ bài đăng khỏi trang", "POST", null)),
            // POST
            rule("POST", "/posts$", m -> new ActionInfo("CREATE_POST", "POST", "Tạo bài đăng", "POST", null)),
            rule("DELETE", "/posts/([\\w-]+)$", m -> new ActionInfo("DELETE_POST", "POST", "Xoá bài đăng", "POST", m.group(1))),
            rule("POST", "/reactions", m -> new ActionInfo("REACT_POST", "POST", "Bày tỏ cảm xúc", "POST", null)),
            rule("POST", "/comments", m -> new ActionInfo("CREATE_COMMENT", "POST", "Bình luận", "POST", null)),
            // STORY
            rule("POST", "/stories$", m -> new ActionInfo("CREATE_STORY", "STORY", "Đăng story", "STORY", null)),
            rule("DELETE", "/admin/stories/([\\w-]+)$", m -> new ActionInfo("DELETE_STORY", "STORY", "Xoá story", "STORY", m.group(1))),
            // REPORT
            rule("POST", "/report$", m -> new ActionInfo("SUBMIT_REPORT", "REPORT", "Gửi báo cáo", null, null)),
            rule("POST", "/admin/reports/(\\d+)/handle$", m -> new ActionInfo("HANDLE_REPORT", "REPORT", "Xử lý báo cáo", "REPORT", m.group(1)))
    );

    private static Rule rule(String method, String regex, Builder b) {
        return new Rule(method, Pattern.compile(regex), b);
    }

    /** Suy ra hành động từ request; trả về null nếu không đáng ghi log. */
    public ActionInfo describe(String method, String path) {
        if (method == null) return null;
        String m = method.toUpperCase();
        // OPTIONS chỉ là preflight CORS, không phải hành động thật
        if (m.equals("OPTIONS")) return null;
        for (Pattern ig : IGNORE) {
            if (ig.matcher(path).find()) return null;
        }
        for (Rule r : RULES) {
            if (!r.method().equals(m)) continue;
            Matcher matcher = r.pattern().matcher(path);
            if (matcher.find()) {
                return r.builder().build(matcher);
            }
        }
        // Request chưa được ánh xạ (bao gồm các lượt đọc GET) -> log chung để không bỏ sót.
        // Lấy "đối tượng" từ path: phân đoạn tài nguyên đầu tiên + id (nếu có) sau /api/.
        String resource = null;
        String tid = null;
        String stripped = path.replaceFirst("^/api/", "");
        String[] segs = stripped.split("/");
        if (segs.length > 0 && !segs[0].isBlank()) resource = segs[0];
        if (segs.length > 1 && segs[1].matches("\\d+")) tid = segs[1];

        // Mô tả = phương thức HTTP + path (GET/POST/PUT/DELETE/PATCH ...)
        String desc = m + " " + path;
        return new ActionInfo(m + "_REQUEST", "SYSTEM", desc, resource, tid);
    }

    /**
     * Ghi một bản ghi nhật ký. Chạy bất đồng bộ để không ảnh hưởng request gốc.
     */
    @Async
    @Transactional
    public void record(String method, String path, int statusCode,
                       String actorPhone, boolean fromAdminConsole, String errorMessage) {
        try {
            ActionInfo info = describe(method, path);
            if (info == null) return;

            String actorType;
            Long actorId = null;
            String actorName;

            User actor = (actorPhone != null) ? userRepository.findByPhone(actorPhone) : null;
            if (actor != null) {
                actorId = actor.getId();
                actorName = (actor.getName() != null && !actor.getName().isBlank())
                        ? actor.getName()
                        : (actor.getUsername() != null ? actor.getUsername() : actor.getPhone());
            } else {
                actorName = actorPhone != null ? actorPhone : "(ẩn danh)";
            }

            if (fromAdminConsole) {
                actorType = "ADMIN";
            } else if (actorPhone != null) {
                actorType = "USER";
            } else {
                actorType = "SYSTEM";
            }

            // Tra cứu tên đối tượng (nếu là USER/PAGE và có id dạng số)
            String targetName = resolveTargetName(info.targetType(), info.targetId());

            AuditLog log = AuditLog.builder()
                    .timestamp(OffsetDateTime.now())
                    .actorType(actorType)
                    .actorId(actorId)
                    .actorName(actorName)
                    .action(info.action())
                    .description(info.description())
                    .category(info.category())
                    .targetType(info.targetType())
                    .targetId(info.targetId())
                    .targetName(targetName)
                    .method(method.toUpperCase())
                    .endpoint(path)
                    .status(statusCode >= 400 ? "FAILED" : "SUCCESS")
                    .statusCode(statusCode)
                    .meta(errorMessage != null ? "{\"error\":\"" + errorMessage.replace("\"", "'") + "\"}" : null)
                    .build();

            auditLogRepository.save(log);

            // Đẩy realtime tới các trang quản trị đang mở
            auditLogStream.broadcast(log);
        } catch (Exception ignored) {
            // Ghi log không bao giờ được làm hỏng request gốc
        }
    }

    /** Tra cứu tên hiển thị của đối tượng bị tác động (USER/PAGE). */
    private String resolveTargetName(String targetType, String targetId) {
        if (targetType == null || targetId == null) return null;
        try {
            Long id = Long.valueOf(targetId);
            switch (targetType.toUpperCase()) {
                case "USER" -> {
                    User u = userRepository.findById(id).orElse(null);
                    if (u == null) return null;
                    return (u.getName() != null && !u.getName().isBlank()) ? u.getName() : u.getUsername();
                }
                case "PAGE" -> {
                    Page p = pageRepository.findById(id).orElse(null);
                    return p != null ? p.getName() : null;
                }
                default -> {
                    return null;
                }
            }
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** Xoá toàn bộ nhật ký. */
    @Transactional
    public void clearAll() {
        auditLogRepository.deleteAllInBatch();
        auditLogStream.broadcastCleared();
    }

    /** Lấy các bản ghi mới nhất. */
    @Transactional(readOnly = true)
    public List<AuditLog> getRecent(int limit) {
        int size = Math.min(Math.max(limit, 1), 2000);
        return auditLogRepository.findAllByOrderByTimestampDesc(PageRequest.of(0, size));
    }
}
