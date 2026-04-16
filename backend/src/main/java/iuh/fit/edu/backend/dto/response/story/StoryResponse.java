package iuh.fit.edu.backend.dto.response.story;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.domain.entity.nosql.Music;
import iuh.fit.edu.backend.domain.entity.nosql.Story;
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
    
    // Content
    private Story.StoryMedia media;
    private String text;
    private Story.TextStyle textStyle;
    private Music music;
    private List<Story.Sticker> stickers;
    
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
    private String highlightCategory;
    
    // Timestamps
    private Instant createdAt;
    private Instant expireAt;
}
