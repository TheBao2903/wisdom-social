/*
 * @ (#) AuditLogStream.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.audit.service;

import iuh.fit.edu.backend.modules.audit.entity.AuditLog;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/*
 * @description Quản lý các kết nối SSE và đẩy log mới về trang quản trị theo thời gian thực.
 * @author: Audit Log
 * @version: 1.0
 */
@Component
public class AuditLogStream {

    /** Giữ kết nối 1 giờ; trình duyệt (EventSource) tự kết nối lại khi hết hạn. */
    private static final long TIMEOUT_MS = 60L * 60L * 1000L;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** Một client (trang quản trị) đăng ký nhận log realtime. */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException ignored) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    /** Đẩy một bản ghi log mới tới tất cả client đang lắng nghe. */
    public void broadcast(AuditLog log) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("audit").data(log));
            } catch (Exception ex) {
                emitters.remove(emitter);
            }
        }
    }

    /** Báo cho tất cả client biết nhật ký đã bị xoá để làm trống danh sách. */
    public void broadcastCleared() {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("cleared").data("ok"));
            } catch (Exception ex) {
                emitters.remove(emitter);
            }
        }
    }
}
