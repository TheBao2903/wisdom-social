/*
 * @ (#) AuditWebConfig.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.audit.config;

import iuh.fit.edu.backend.modules.audit.interceptor.AuditLogInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/*
 * @description Đăng ký interceptor ghi nhật ký hành động cho các request /api.
 * @author: Audit Log
 * @version: 1.0
 */
@Configuration
@RequiredArgsConstructor
public class AuditWebConfig implements WebMvcConfigurer {

    private final AuditLogInterceptor auditLogInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(auditLogInterceptor).addPathPatterns("/api/**");
    }
}
