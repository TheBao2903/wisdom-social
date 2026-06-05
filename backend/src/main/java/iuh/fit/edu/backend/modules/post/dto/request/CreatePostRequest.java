/*
 * @ (#) CreatePostRequest.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.dto.request;

import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.music.entity.Music;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import iuh.fit.edu.backend.modules.post.dto.request.MediaUploadMetadataRequest;
import lombok.Data;

import java.util.List;

/*
 * @description: Request DTO for creating a post
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreatePostRequest {
    private String content;
    private PrivacyType privacy;
    private String location;
    private List<String> taggedUsernames; // Usernames of tagged people
    private List<String> taggedUserIds; // User IDs of tagged people (for update)
    private List<String> specificViewerUsernames; // For SPECIFIC privacy
    private List<String> excludedUsernames; // For FRIENDS_EXCEPT privacy
    private List<String> existingMediaUrls; // URLs of existing media to keep (for update)
    private List<MediaUploadMetadataRequest> mediaMetadatas; // metadata aligned with uploaded media order
    private Boolean allowComments;
    private Boolean allowShares;
    private Music music;
}
