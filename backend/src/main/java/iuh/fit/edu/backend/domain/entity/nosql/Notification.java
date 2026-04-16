/*
 * @ (#) Notification.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.NotificationType;
import iuh.fit.edu.backend.constant.TargetType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/*
 * @description: Notification entity for social network activities
 * Tối ưu: Sử dụng compound index cho query theo userId + isRead
 * Aggregation: Group notifications cùng loại trong 1 khoảng thời gian
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "user_read_created_idx",
                def = "{'recipientId': 1, 'isRead': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "user_type_idx",
                def = "{'recipientId': 1, 'type': 1, 'createdAt': -1}"
        )
})
public class Notification {

    @Id
    private String id;

    // Người nhận thông báo
    @Indexed
    private String recipientId;

    // Người thực hiện hành động (có thể có nhiều người cùng react 1 post)
    private List<String> actorIds;

    // Loại thông báo
    private NotificationType type;

    // Đối tượng liên quan (POST, COMMENT, STORY...)
    private TargetType targetType;
    private String targetId;

    // Nội dung bổ sung (VD: nội dung comment, số người like...)
    private String content;
    private NotificationMetadata metadata;

    // Trạng thái
    private boolean isRead;
    private Instant readAt;

    // Thời gian
    private Instant createdAt;

    // TTL - Tự động xóa sau 90 ngày (config via MongoConfig)
    @Indexed
    private Instant expireAt;
}

/**
 * Metadata bổ sung cho notification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class NotificationMetadata {
    // Preview image/avatar
    private String imageUrl;

    // Số lượng người tương tác (VD: "Bạn và 15 người khác")
    private Integer count;

    // Link đích
    private String deepLink;

    // Dữ liệu bổ sung dạng JSON
    private String extraData;
}
