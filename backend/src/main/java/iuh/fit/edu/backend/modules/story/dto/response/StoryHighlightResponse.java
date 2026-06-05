package iuh.fit.edu.backend.modules.story.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Story Highlight Response DTO
 * Contains highlight metadata and its stories
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoryHighlightResponse {
    private String id;
    private String userId;
    private String title;
    private String coverImageUrl;
    private List<StoryResponse> stories;
    private Integer displayOrder;
    private long viewCount;
    private Instant createdAt;
    private Instant updatedAt;
}
