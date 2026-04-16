package iuh.fit.edu.backend.dto.request.story;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.domain.entity.nosql.Music;
import iuh.fit.edu.backend.domain.entity.nosql.Story;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Create Story Request DTO
 * Used for POST /api/stories
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateStoryRequest {
    
    // Media information
    private Story.StoryMedia media;
    
    // Text overlay
    private String text;
    private Story.TextStyle textStyle;
    
    // Music/soundtrack
    private Music music;
    
    // Stickers and decorations
    private List<Story.Sticker> stickers;
    
    // Privacy and interaction settings
    private PrivacyType privacy;
    private boolean allowReplies;
    private boolean allowReactions;
    private boolean allowSharing;
}
