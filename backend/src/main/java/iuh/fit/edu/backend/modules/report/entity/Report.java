/*
 * @ (#) Report.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.report.entity;

import iuh.fit.edu.backend.modules.report.constant.ReportReason;
import iuh.fit.edu.backend.modules.report.constant.ReportStatus;
import iuh.fit.edu.backend.modules.report.constant.ReportTargetType;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * Báo cáo do người dùng gửi về một tài khoản hoặc một trang.
 * Admin tiếp nhận, xem lý do và xử lý (RESOLVED / DISMISSED).
 */
@Entity
@Table(name = "reports", indexes = {
        @Index(name = "idx_report_status", columnList = "status"),
        @Index(name = "idx_report_target", columnList = "targetType,targetId"),
        @Index(name = "idx_report_created", columnList = "createdAt")
})
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** USER hoặc PAGE */
    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private ReportTargetType targetType;

    /** id của user/page bị báo cáo */
    @Column(nullable = false)
    private Long targetId;

    /** Tên hiển thị của đối tượng tại thời điểm báo cáo (cho admin xem nhanh) */
    @Column(length = 255)
    private String targetName;

    /** Ảnh đại diện của đối tượng tại thời điểm báo cáo */
    @Column(length = 1024)
    private String targetAvatarUrl;

    /** Người gửi báo cáo */
    @Column(nullable = false)
    private Long reporterId;

    @Column(length = 255)
    private String reporterName;

    /** Lý do (bắt buộc) */
    @Enumerated(EnumType.STRING)
    @Column(length = 32, nullable = false)
    private ReportReason reason;

    /** Mô tả chi tiết thêm (tuỳ chọn) */
    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;

    /** Ghi chú của admin khi xử lý */
    @Column(length = 1000)
    private String adminNote;

    /** Admin đã xử lý báo cáo */
    private Long handledById;

    @Column(length = 255)
    private String handledByName;

    private OffsetDateTime createdAt;
    private OffsetDateTime handledAt;
}
