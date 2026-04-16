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

/*
 * @description: Note entity (short text with music - like Facebook Notes/Mood)
 * Tối ưu: TTL index tự động xóa sau 24-48h
 * Compound index cho query notes của user
 * @author: The Bao
 * @date: 2026-01-20
 * @version: 1.0
 */
@Document(collection = "notes")
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
public class Note {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String content;

    // Location tag
    private String location;

    // Background theme
    private NoteTheme theme;

    private Music music;

    // Privacy
    private PrivacyType privacy;

    // Stats
    private NoteStats stats;

    // Status
    private StatusType status;

    // Timestamps
    private Instant createdAt;
    
    // TTL - Tự động xóa sau 24h (86400 seconds)
    // MongoDB sẽ tự động xóa document khi expireAt đã qua
    @Indexed(expireAfter  = "PT0S") // 0 = xóa ngay khi expireAt time đến
    private Instant expireAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class NoteTheme {
    private String backgroundType; // solid | gradient | image
    private String backgroundColor;
    private String gradientColors; // JSON array
    private String backgroundImageUrl;
    private String textColor;
    private String fontFamily;
    private String fontSize;
    private String textAlign;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class NoteStats {
    private long reactCount;
    private long commentCount;
    private long viewCount;
}