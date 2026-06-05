/*
 * @ (#) ReportStream.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.report.service;

import iuh.fit.edu.backend.modules.report.dto.response.ReportResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Quản lý các kết nối SSE và đẩy báo cáo mới / cập nhật trạng thái về trang quản trị theo thời gian thực.
 * Cùng mô hình với AuditLogStream để frontend-admin tái sử dụng dễ dàng (EventSource + withCredentials).
 */
@Component
public class ReportStream {

    /** Giữ kết nối 1 giờ; trình duyệt (EventSource) tự kết nối lại khi hết hạn. */
    private static final long TIMEOUT_MS = 60L * 60L * 1000L;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** Một client (trang quản trị) đăng ký nhận báo cáo realtime. */
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

    /** Đẩy một báo cáo mới tới tất cả admin đang lắng nghe. */
    public void broadcastNew(ReportResponse report) {
        send("report", report);
    }

    /** Đẩy báo cáo vừa được cập nhật trạng thái (để các tab admin khác đồng bộ). */
    public void broadcastUpdated(ReportResponse report) {
        send("report-updated", report);
    }

    private void send(String eventName, ReportResponse report) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(report));
            } catch (Exception ex) {
                emitters.remove(emitter);
            }
        }
    }
}
