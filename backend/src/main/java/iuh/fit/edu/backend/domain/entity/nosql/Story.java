/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.nosql.embeddable.Location;
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

    // Media (image/video)
    private StoryMedia media;

    // Text overlay
    private String text;
    private TextStyle textStyle;

    // Music/Audio
    private Music music;

    // Stickers/GIFs
    private List<Sticker> stickers;

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
    
    // TTL - Tự động xóa sau 24h (config via MongoConfig)
    // QUAN TRỌNG: CHỈ set expireAt nếu isArchived = false
    // Nếu user muốn lưu story làm Highlight, set isArchived=true và KHÔNG set expireAt
    @Indexed
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
        private Long duration; // cho video
        // Filter/Effect applied
        private String filterName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TextStyle {
        private String fontFamily;
        private String fontSize;
        private String color;
        private String backgroundColor;
        private String alignment; // left | center | right
        private String animation; // fade | slide | bounce...
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Sticker {
        private String type; // emoji | gif | poll | question | countdown | location
        private String url;
        private Position position;
        private Integer rotation; // degrees
        private Float scale;
        private String data; // JSON data cho interactive stickers (poll, question...)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Position {
        private Float x; // percentage
        private Float y; // percentage
    }
}