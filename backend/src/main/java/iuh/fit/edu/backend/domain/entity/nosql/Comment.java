/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.StatusType;
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
 * @description: Comment entity with nested replies support
 * Tối ưu: Compound index cho query comments của post/target
 * Hỗ trợ thread replies với parentId
 * @author: Huu Thai
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "comments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "target_created_idx",
                def = "{'targetType': 1, 'targetId': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "parent_created_idx",
                def = "{'parentId': 1, 'createdAt': 1}"
        )
})
public class Comment {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private TargetType targetType;
    @Indexed
    private String targetId;

    // Reply to comment (nested comment/thread)
    @Indexed
    private String parentId;

    private String content;
    
    // Mentions trong comment
    private List<String> mentions;

    // Media trong comment (ảnh, GIF, sticker)
    private CommentMedia media;

    // Stats
    private long reactCount;
    private long replyCount; // Số lượng reply (nếu là parent comment)

    // Status
    private StatusType status;
    private boolean isEdited;
    private boolean isPinned; // Ghim comment (cho admin/author)

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class CommentMedia {
    private String url;
    private String type; // image | gif | sticker
    private String thumbnailUrl;
    private Integer width;
    private Integer height;
}