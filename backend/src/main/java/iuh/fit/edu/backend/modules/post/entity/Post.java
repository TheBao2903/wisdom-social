/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.entity;

import iuh.fit.edu.backend.modules.media.entity.Media;
import iuh.fit.edu.backend.modules.music.entity.Music;
import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/*
 * @description: Post entity with optimization for social media features
 * Tối ưu: Compound index cho newsfeed query (authorId + createdAt)
 * Text index cho search content
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "posts")
@Data
@ToString
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "author_created_idx",
                def = "{'authorId': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "status_ranking_idx",
                def = "{'status': 1, 'rankingTime': -1}"
        ),
        @CompoundIndex(
                name = "author_status_ranking_idx",
                def = "{'authorId': 1, 'status': 1, 'rankingTime': -1}"
        )
})
public class Post {

    @Id
    private String id;

        @Indexed(name = "post_author_idx")
    private String authorId;
    
    // Text search index cho content
    @Indexed
    private String content;

    private PrivacyType privacy;
    
    // Privacy settings for SPECIFIC and EXCEPT
    private List<String> specificViewerUserIds; // For SPECIFIC privacy
    private List<String> excludedUserIds; // For EXCEPT privacy

    private List<Media> media;

    // Location/Check-in
    private Location location;

    // Tags (người được tag trong post)
    private List<String> taggedUserIds;

    // Hashtags
    private List<String> hashtags;

    // Mentions trong content
    private List<String> mentions;

    // Feeling/Activity (VD: "feeling happy", "watching Avengers")
    private Activity activity;

    private Music music;

    @org.springframework.data.annotation.Transient
    private Map<String, Object> authorSummary;

    // Background cho text post (như Facebook colored background)
    private String backgroundStyle;

    private Stats stats;

    // Visibility settings
    private StatusType status;
    private boolean isEdited;
    @Builder.Default
    private boolean allowComments = true;
    @Builder.Default
    private boolean allowShares = true;

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;

    @Indexed(direction = IndexDirection.DESCENDING)
    @Builder.Default
    private Instant lastActivityAt = Instant.now();

    @Indexed(direction = IndexDirection.DESCENDING)
    @Builder.Default
    private Instant rankingTime = Instant.now();

    private Instant scheduledAt; // Hẹn giờ đăng

    // Add manual constructor to ensure lastActivityAt is never null for old-style instantiation
    public void setLastActivityAt(Instant lastActivityAt) {
        this.lastActivityAt = lastActivityAt != null ? lastActivityAt : (this.createdAt != null ? this.createdAt : Instant.now());
    }

    public void recalculateRankingTime() {
        if (this.stats == null) {
            this.rankingTime = this.createdAt != null ? this.createdAt : Instant.now();
            return;
        }

        long reactionBoost = (long) (Math.log1p(stats.getReactCount()) * 2);
        long commentBoost = (long) (Math.log1p(stats.getCommentCount()) * 12);
        long replyBoost = (long) (Math.log1p(stats.getReplyCount()) * 5);
        long friendCommentBoost = (long) (Math.log1p(stats.getFriendCommentCount()) * 30);

        long totalBoost = reactionBoost + commentBoost + replyBoost + friendCommentBoost;

        Instant baseTime = this.createdAt != null ? this.createdAt : Instant.now();
        long ageHours = ChronoUnit.HOURS.between(baseTime, Instant.now());
        
        double freshnessMultiplier;
        if (ageHours < 24) {
            freshnessMultiplier = 1.0;
        } else if (ageHours < 72) {
            freshnessMultiplier = 0.4;
        } else {
            freshnessMultiplier = 0.0;
        }

        long finalBoostMinutes = (long) (totalBoost * freshnessMultiplier);
        
        // Cap the maximum boost to 6 hours
        finalBoostMinutes = Math.min(finalBoostMinutes, 360);

        this.rankingTime = baseTime.plus(finalBoostMinutes, ChronoUnit.MINUTES);
    }
}
