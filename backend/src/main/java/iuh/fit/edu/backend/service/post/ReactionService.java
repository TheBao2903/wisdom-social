/*
 * @ (#) ReactionService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.post;

import iuh.fit.edu.backend.constant.ReactionType;
import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Reaction;

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
}
