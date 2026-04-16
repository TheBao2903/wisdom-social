package iuh.fit.edu.backend.domain.entity.nosql;

import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/*
 * @description: MusicMetadata entity - Music tracks from external sources (Spotify, YouTube, etc.)
 * Stores metadata and links to Cloudflare R2 for audio and image files
 * @author: The Bao
 * @date: 2026-03-23
 * @version: 1.0
 */
@Document(collection = "music_metadata")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MusicMetadata {

    @Id
    private String id;

    // Track info
    private String title;
    private String artist;
    private Integer duration; // seconds

    // Links to Cloudflare R2
    private String imageUrl;
    private String audioUrl;

    // Metadata
    private Instant createdAt;
}
