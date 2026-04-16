/*
 * @ (#) StoryHighlight.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

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
 * @description: Story Highlights - Lưu trữ vĩnh viễn stories đặc biệt (giống Instagram Highlights)
 * User có thể tạo nhiều Highlight categories (Travel, Food, Family...)
 * Mỗi Highlight chứa nhiều Stories
 * KHÔNG có TTL - lưu vĩnh viễn cho đến khi user xóa
 * @author: Huu Thai
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "story_highlights")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "user_order_idx",
                def = "{'userId': 1, 'displayOrder': 1}"
        )
})
public class StoryHighlight {

    @Id
    private String id;

    @Indexed
    private String userId;

    // Tên category highlight (VD: "Du lịch 2025", "Ăn uống", "Gia đình"...)
    private String title;

    // Cover image cho highlight
    private String coverImageUrl;

    // Danh sách story IDs trong highlight này
    // LƯU Ý: Stories phải có isArchived = true để không bị TTL xóa
    private List<String> storyIds;

    // Display order (để user sắp xếp highlights theo ý muốn)
    private Integer displayOrder;

    // Stats
    private long viewCount;

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;
}
