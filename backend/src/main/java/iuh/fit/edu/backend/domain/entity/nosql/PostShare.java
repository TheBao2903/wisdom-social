/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.constant.StatusType;
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
 * @description: PostShare entity for tracking post shares with caption
 * Tối ưu: Compound index cho query shares của post và user
 * Track viral content với stats
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "post_shares")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "original_post_idx",
                def = "{'originalPostId': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "shared_by_user_idx",
                def = "{'sharedByUserId': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "unique_user_post",
                def = "{'sharedByUserId': 1, 'originalPostId': 1}",
                unique = true
        )
})
public class PostShare {

    @Id
    private String id;

    @Indexed
    private String originalPostId;
    
    @Indexed
    private String sharedByUserId;

    // Caption khi share
    private String content;
    
    // Mentions trong caption
    private List<String> mentions;
    
    // Tags
    private List<String> taggedUserIds;
    
    // Privacy của share
    private PrivacyType privacy;

    // Stats cho share (reaction/comment trên share, không phải post gốc)
    private ShareStats stats;

    // Status
    private StatusType status;

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class ShareStats {
    private long reactCount;
    private long commentCount;
    private long shareCount;
    private long viewCount;
}