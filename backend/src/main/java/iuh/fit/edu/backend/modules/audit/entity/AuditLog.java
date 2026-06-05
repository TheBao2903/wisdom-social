/*
 * @ (#) AuditLog.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.audit.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/*
 * @description Bản ghi nhật ký hành động của quản trị viên và người dùng.
 * @author: Audit Log
 * @version: 1.0
 */
@Entity
@Table(
        name = "audit_logs",
        indexes = {
                @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
                @Index(name = "idx_audit_actor_type", columnList = "actorType"),
                @Index(name = "idx_audit_category", columnList = "category")
        }
)
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private OffsetDateTime timestamp;

    /** ADMIN | USER | SYSTEM */
    @Column(length = 16)
    private String actorType;

    private Long actorId;

    @Column(length = 255)
    private String actorName;

    /** Mã hành động, vd: LOCK_USER */
    @Column(length = 64)
    private String action;

    @Column(length = 512)
    private String description;

    /** AUTH | USER | PAGE | POST | STORY | MUSIC | SYSTEM */
    @Column(length = 32)
    private String category;

    @Column(length = 32)
    private String targetType;

    @Column(length = 64)
    private String targetId;

    @Column(length = 255)
    private String targetName;

    @Column(length = 8)
    private String method;

    @Column(length = 512)
    private String endpoint;

    /** SUCCESS | FAILED */
    @Column(length = 16)
    private String status;

    private Integer statusCode;

    /** Dữ liệu bổ sung dạng JSON (lý do, thông báo lỗi...) */
    @Column(length = 1024)
    private String meta;
}
