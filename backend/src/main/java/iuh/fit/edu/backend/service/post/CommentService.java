/*
 * @ (#) CommentService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.post;

import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Comment;
import iuh.fit.edu.backend.dto.request.post.CreateCommentRequest;

import java.util.List;

/*
 * @description: Service interface for Comment operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
public interface CommentService {
    Comment createComment(CreateCommentRequest request, Long userId);
    List<Comment> getCommentsByTarget(TargetType targetType, String targetId);
    List<Comment> getRepliesByParentId(String parentId);
    void deleteComment(String commentId, Long userId);
}
