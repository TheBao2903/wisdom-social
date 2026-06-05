/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.entity;

import iuh.fit.edu.backend.modules.music.entity.Music;
import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.post.entity.Location;
import iuh.fit.edu.backend.modules.post.entity.Stats;
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
 * @description: Story entity (24h temporary content like Instagram/Facebook Stories)
 * Tối ưu: TTL index tự động xóa sau 24h
 * Compound index cho query stories của user và bạn bè
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "stories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(
                name = "user_created_idx",
                def = "{'userId': 1, 'createdAt': -1}"
        ),
        @CompoundIndex(
                name = "status_expire_idx",
                def = "{'status': 1, 'expireAt': 1}"
        )
})
public class Story {

    @Id
    private String id;

    @Indexed
    private String userId;

    // Content (text and background gradients)
    private String content;

    // Media (image/video)
    private StoryMedia media;

    // Text layers (with positioning and styling)
    private List<TextLayer> text_layers;

    // Music/Audio
    private Music music;

    // Music stickers (with positioning and metadata)
    private List<MusicSticker> music_stickers;

    // Story duration in milliseconds (auto-calculated based on media type)
    private Long duration_ms;

    // Tags
    private List<String> taggedUserIds;
    private List<String> mentions;

    // Location
    private Location location;

    // Privacy
    private PrivacyType privacy;

    // Interaction settings
    private boolean allowReplies;
    private boolean allowReactions;
    private boolean allowSharing;

    // Stats (shared with Post)
    private Stats stats;
    
    // Reply count (specific to stories)
    private long replyCount;

    // Viewers tracking (lưu trong collection riêng StoryView)
    // Giờ chỉ cần count

    // Status
    private StatusType status;
    
    // Archive/Highlight (nếu true thì KHÔNG set expireAt -> lưu vĩnh viễn)
    private boolean isArchived;
    private String highlightCategory; // Tên category highlight (VD: "Travel", "Food"...)

    // Timestamps
    private Instant createdAt;
    
    // TTL - MongoDB tự động xóa document khi thời gian hiện tại >= expireAt
    // expireAfterSeconds = 0 => MongoDB sẽ xóa tại đúng thời điểm expireAt
    // QUAN TRỌNG: CHỈ set expireAt nếu isArchived = false
    // Nếu user muốn lưu story làm Highlight, set isArchived=true và KHÔNG set expireAt
    @Indexed(name = "story_ttl_idx", expireAfter = "0s")
    private Instant expireAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StoryMedia {
        private String url;
        private String type; // image | video
        private String thumbnailUrl;
        private Integer width;
        private Integer height;
        private Long duration_ms; // Duration in milliseconds for video
        // Filter/Effect applied
        private String filterName;
    }
}