/*
 * @ (#) AuditLogInterceptor.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.audit.interceptor;

import iuh.fit.edu.backend.modules.audit.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/*
 * @description Tự động ghi nhật ký mọi request thay đổi dữ liệu (POST/PUT/DELETE/PATCH)
 *              cho cả quản trị viên (admin console) lẫn người dùng.
 * @author: Audit Log
 * @version: 1.0
 */
@Component
@RequiredArgsConstructor
public class AuditLogInterceptor implements HandlerInterceptor {

    private final AuditLogService auditLogService;

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        try {
            String method = request.getMethod();
            String path = request.getRequestURI();

            // Người thực hiện (phone là principal do JwtAuthFilter set)
            String actorPhone = null;
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()
                    && auth.getPrincipal() instanceof String principal
                    && !"anonymousUser".equals(principal)) {
                actorPhone = principal;
            }

            // Phân biệt thao tác từ trang quản trị
            boolean fromAdminConsole = "admin-console".equalsIgnoreCase(request.getHeader("X-Client"));

            String errorMessage = null;
            int statusCode = response.getStatus();
            if (ex != null) {
                errorMessage = ex.getMessage();
                if (statusCode < 400) statusCode = 500;
            }

            auditLogService.record(method, path, statusCode, actorPhone, fromAdminConsole, errorMessage);
        } catch (Exception ignored) {
            // Không bao giờ để việc ghi log ảnh hưởng tới response
        }
    }
}
