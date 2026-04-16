/*
 * @ (#) SocialStats.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql.embeddable;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * @description: Social statistics embeddable class (shared by Group, Page)
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialStats {
    private long memberCount; // Số lượng thành viên (Group) hoặc followers (Page)
    private long postCount; // Số bài viết
    private long viewCount; // Số lượt xem
    private long engagementRate; // Tỷ lệ tương tác
}
