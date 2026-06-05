/*
 * @ (#) NotificationMetadata.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.notification.entity.mongodb;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Metadata bổ sung cho notification
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationMetadata {
    // Preview image/avatar
    private String imageUrl;

    // Tên người thực hiện hành động (fullname) để hiển thị in đậm đầu thông báo
    private String actorName;

    // Số lượng người tương tác (VD: "Bạn và 15 người khác")
    private Integer count;

    // Link đích
    private String deepLink;

    // Dữ liệu bổ sung dạng JSON
    private String extraData;
}
