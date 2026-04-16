/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.nosql.embeddable.Location;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

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
                name = "status_created_idx",
                def = "{'status': 1, 'createdAt': -1}"
        )
})
public class Post {

    @Id
    private String id;

    @Indexed
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

    // Background cho text post (như Facebook colored background)
    private String backgroundStyle;

    private Stats stats;

    // Visibility settings
    private StatusType status;
    private boolean isEdited;
    private boolean allowComments;
    private boolean allowShares;

    // Timestamps
    private Instant createdAt;
    private Instant updatedAt;
    private Instant scheduledAt; // Hẹn giờ đăng
}
