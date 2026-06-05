package iuh.fit.edu.backend.modules.story.dto.response;

import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.music.entity.Music;
import iuh.fit.edu.backend.modules.story.entity.Story;
import iuh.fit.edu.backend.modules.story.entity.TextLayer;
import iuh.fit.edu.backend.modules.story.entity.MusicSticker;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Story Response DTO
 * Used for GET responses and story details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoryResponse {
    
    // Identifiers
    private String id;
    private String userId;
    private UserSummary user;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserSummary {
        private String username;
        private String avatarUrl;
    }
    
    // Content
    private String content;
    private Story.StoryMedia media;
    private java.util.List<iuh.fit.edu.backend.modules.story.entity.TextLayer> text_layers;
    private iuh.fit.edu.backend.modules.music.entity.Music music;
    private java.util.List<iuh.fit.edu.backend.modules.story.entity.MusicSticker> music_stickers;
    
    // Duration
    private Long duration_ms;
    
    // Privacy and interaction settings
    private PrivacyType privacy;
    private boolean allowReplies;
    private boolean allowReactions;
    private boolean allowSharing;
    
    // Engagement metrics
    private int viewCount;
    private int reactCount;
    private int replyCount;
    private int shareCount;
    
    // Archive and lifecycle
    private boolean isArchived;
    
    @com.fasterxml.jackson.annotation.JsonProperty("isViewed")
    private boolean isViewed;
    
    private String highlightCategory;
    
    // Timestamps
    private Instant createdAt;
    private Instant expireAt;
}
