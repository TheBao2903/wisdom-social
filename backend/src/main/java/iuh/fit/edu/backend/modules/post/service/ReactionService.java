/*
 * @ (#) ReactionService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.service;

import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import iuh.fit.edu.backend.modules.post.dto.response.ReactionSummaryResponse;

import java.util.List;

/*
 * @description: Service interface for Reaction operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
public interface ReactionService {
    
    /**
     * Toggle reaction - if exists and same type, remove it; if different type, update it; if not exists, create it
     */
    Reaction toggleReaction(String userId, TargetType targetType, String targetId, ReactionType reactionType);
    
    /**
     * Get all reactions for a target
     */
    List<Reaction> getReactionsByTarget(TargetType targetType, String targetId);
    
    /**
     * Get user's reaction for a target
     */
    Reaction getUserReaction(String userId, TargetType targetType, String targetId);

    /**
     * Get reaction summary (total + top reaction types) for a target
     */
    ReactionSummaryResponse getReactionSummary(TargetType targetType, String targetId, int topLimit);
}
