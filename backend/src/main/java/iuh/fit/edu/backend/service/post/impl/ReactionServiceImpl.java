/*
 * @ (#) ReactionServiceImpl.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.post.impl;

import iuh.fit.edu.backend.constant.ReactionType;
import iuh.fit.edu.backend.constant.TargetType;
import iuh.fit.edu.backend.domain.entity.nosql.Reaction;
import iuh.fit.edu.backend.domain.entity.nosql.Post;
import iuh.fit.edu.backend.repository.nosql.ReactionRepository;
import iuh.fit.edu.backend.service.post.ReactionService;
import iuh.fit.edu.backend.repository.nosql.PostRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/*
 * @description: Service implementation for Reaction operations
 * @author: GitHub Copilot
 * @date: 2026-01-31
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReactionServiceImpl implements ReactionService {

    private final ReactionRepository reactionRepository;
    private final PostRepository postRepository;

    @Override
    @Transactional
    public Reaction toggleReaction(String userId, TargetType targetType, String targetId, ReactionType reactionType) {
        log.info("Toggle reaction: userId={}, targetType={}, targetId={}, reactionType={}", 
                userId, targetType, targetId, reactionType);

        Optional<Reaction> existingReaction = reactionRepository
                .findByUserIdAndTargetTypeAndTargetId(userId, targetType, targetId);

        if (existingReaction.isPresent()) {
            Reaction reaction = existingReaction.get();
            
            // If same type, remove reaction (unlike)
            if (reaction.getType() == reactionType) {
                reactionRepository.delete(reaction);
                log.info("Removed reaction: {}", reaction.getId());
                
                // Update post stats if target is POST
                if (targetType == TargetType.POST) {
                    updatePostReactCount(targetId, -1);
                }
                
                return null;
            }
            
            // If different type, update reaction
            reaction.setType(reactionType);
            reaction.setUpdatedAt(Instant.now());
            Reaction updated = reactionRepository.save(reaction);
            log.info("Updated reaction: {}", updated.getId());
            return updated;
        }

        // Create new reaction
        Reaction newReaction = new Reaction();
        newReaction.setUserId(userId);
        newReaction.setTargetType(targetType);
        newReaction.setTargetId(targetId);
        newReaction.setType(reactionType);
        newReaction.setCreatedAt(Instant.now());
        newReaction.setUpdatedAt(Instant.now());

        Reaction saved = reactionRepository.save(newReaction);
        log.info("Created new reaction: {}", saved.getId());
        
        // Update post stats if target is POST
        if (targetType == TargetType.POST) {
            updatePostReactCount(targetId, 1);
        }
        
        return saved;
    }

    private void updatePostReactCount(String postId, int delta) {
        postRepository.findById(postId).ifPresent(post -> {
            if (post.getStats() != null) {
                long newCount = Math.max(0L, post.getStats().getReactCount() + delta);
                post.getStats().setReactCount(newCount);
                postRepository.save(post);
                log.info("Updated post {} reactCount to: {}", postId, newCount);
            }
        });
    }

    @Override
    public List<Reaction> getReactionsByTarget(TargetType targetType, String targetId) {
        log.info("Get reactions for target: targetType={}, targetId={}", targetType, targetId);
        return reactionRepository.findByTargetTypeAndTargetId(targetType, targetId);
    }

    @Override
    public Reaction getUserReaction(String userId, TargetType targetType, String targetId) {
        log.info("Get user reaction: userId={}, targetType={}, targetId={}", userId, targetType, targetId);
        return reactionRepository.findByUserIdAndTargetTypeAndTargetId(userId, targetType, targetId)
                .orElse(null);
    }
}
