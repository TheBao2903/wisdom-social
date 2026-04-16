/*
 * @ (#) CreatePostRequest.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.dto.request.post;

import iuh.fit.edu.backend.constant.PrivacyType;
import lombok.Data;

import java.util.List;

/*
 * @description: Request DTO for creating a post
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Data
public class CreatePostRequest {
    private String content;
    private PrivacyType privacy;
    private String location;
    private List<String> taggedUsernames; // Usernames of tagged people
    private List<String> taggedUserIds; // User IDs of tagged people (for update)
    private List<String> specificViewerUsernames; // For SPECIFIC privacy
    private List<String> excludedUsernames; // For FRIENDS_EXCEPT privacy
    private List<String> existingMediaUrls; // URLs of existing media to keep (for update)
    private Boolean allowComments;
    private Boolean allowShares;
}
