/*
 * @ (#) AuditLogController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.audit.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.audit.entity.AuditLog;
import iuh.fit.edu.backend.modules.audit.service.AuditLogService;
import iuh.fit.edu.backend.modules.audit.service.AuditLogStream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/*
 * @description Endpoint cho trang quản trị đọc nhật ký hành động.
 * @author: Audit Log
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/admin/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;
    private final AuditLogStream auditLogStream;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AuditLog>>> getLogs(
            @RequestParam(defaultValue = "1000") int limit) {
        List<AuditLog> logs = auditLogService.getRecent(limit);
        return ResponseEntity.ok(ApiResponse.success(200, "Audit logs", logs));
    }

    /** Luồng SSE đẩy log mới về trang quản trị theo thời gian thực. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return auditLogStream.subscribe();
    }

    /** Xoá toàn bộ lịch sử nhật ký. */
    @DeleteMapping
    public ResponseEntity<ApiResponse<String>> clear() {
        auditLogService.clearAll();
        return ResponseEntity.ok(ApiResponse.success(200, "Audit logs cleared", null));
    }
}
