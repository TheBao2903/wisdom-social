/*
 * @ (#) CreateCommentRequest.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.dto.request;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * @description: Request DTO for creating comment
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCommentRequest {
    
    @NotNull(message = "Target type is required")
    private TargetType targetType;
    
    @NotBlank(message = "Target ID is required")
    private String targetId;
    
    private String parentId; // null if root comment, otherwise reply to comment
    
    @NotBlank(message = "Content is required")
    private String content;

    private List<MentionRequest> mentions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MentionRequest {
        private String userId;
        private String username;
    }
}
