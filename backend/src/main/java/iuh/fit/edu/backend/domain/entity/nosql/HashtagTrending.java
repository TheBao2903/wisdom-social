/*
 * @ (#) HashtagTrending.java    1.0
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
 * @description: Trending hashtags tracking (tương tự Twitter/X Trending)
 * Tối ưu: TTL index tự động xóa dữ liệu cũ
 * Aggregation pipeline tính trending score real-time
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "hashtag_trending")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "hashtag_period_idx",
                def = "{'hashtag': 1, 'period': 1}",
                unique = true
        ),
        @CompoundIndex(
                name = "period_score_idx",
                def = "{'period': 1, 'trendingScore': -1, 'updatedAt': -1}"
        )
})
public class HashtagTrending {

    @Id
    private String id;

    @Indexed
    private String hashtag;

    // Period: hourly | daily | weekly
    private String period;

    // Stats
    private TrendingStats stats;

    // Trending score (tính toán dựa trên velocity + engagement)
    private Double trendingScore;

    // Sample posts using this hashtag
    private List<String> samplePostIds;

    // Timestamps
    private Instant startTime;
    private Instant endTime;
    private Instant updatedAt;

    // TTL - Tự động xóa sau 30 ngày (config via MongoConfig)
    @Indexed
    private Instant expireAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class TrendingStats {
    private long postCount;
    private long userCount; // Số user unique sử dụng
    private long viewCount;
    private long engagementCount; // reactions + comments + shares
    
    // Velocity (tốc độ tăng trưởng)
    private Double velocity;
    
    // Peak time
    private Instant peakTime;
}
