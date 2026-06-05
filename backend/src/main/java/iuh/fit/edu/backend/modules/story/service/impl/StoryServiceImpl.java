package iuh.fit.edu.backend.modules.story.service.impl;

import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.story.entity.Story;
import iuh.fit.edu.backend.modules.story.entity.StoryView;
import iuh.fit.edu.backend.modules.post.entity.Stats;
import iuh.fit.edu.backend.modules.story.repository.StoryRepository;
import iuh.fit.edu.backend.modules.story.repository.StoryViewRepository;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import iuh.fit.edu.backend.modules.story.service.StoryService;
import iuh.fit.edu.backend.modules.story.config.StoryDurationCalculator;
import iuh.fit.edu.backend.modules.post.repository.ReactionRepository;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.util.*;

/*
 * @description: Story service implementation
 * @author: [Your Name]
 * @date: 24/03/2026
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StoryServiceImpl implements StoryService {

    private final StoryRepository storyRepository;
    private final StoryViewRepository storyViewRepository;
    private final ReactionRepository reactionRepository;
    private final MongoTemplate mongoTemplate;
    private final S3Service s3Service;
    private final FriendRepository friendRepository;
    private final StoryDurationCalculator durationCalculator;
    
    private static final long STORY_VALID_DURATION_HOURS = 24;

    /**
     * Create a new story with file uploads
     * - First creates story in MongoDB to get ID
     * - Then uploads media files to S3
     * - Finally updates story with media URLs
     * - Calculate and set story duration
     */
    @Override
    @Transactional
    public Story createStory(Story story, String userId, List<String> mediaUrls) throws IOException {
        log.info("Creating story with media for user: {}", userId);
        
        // Step 1: Create story first to get ID
        Story createdStory = createStoryInternal(story, userId);
        
        // Step 2: Move media files from temp to final location if provided
        if (mediaUrls != null && !mediaUrls.isEmpty()) {
            try {
                // Move first uploaded file as main media
                String tempUrl = mediaUrls.get(0);
                
                // Detect media type from file extension
                String extension = tempUrl.substring(tempUrl.lastIndexOf(".") + 1).toLowerCase();
                String mediaType = getMediaType(extension);
                
                String finalUrl = s3Service.relocateStoryMediaKey(tempUrl, createdStory.getId(), mediaType);
                
                Story.StoryMedia storyMedia = Story.StoryMedia.builder()
                        .type(mediaType)
                        .url(finalUrl)
                        .width(1080)
                        .height(1920)
                        .build();
                createdStory.setMedia(storyMedia);
                createdStory = storyRepository.save(createdStory);
                
                log.info("Moved {} media files for story: {}", mediaUrls.size(), createdStory.getId());
            } catch (Exception e) {
                log.warn("Error moving media for story: {}", createdStory.getId(), e);
                // Continue without media if move fails
            }
        }
        
        // Step 3: Calculate and set duration based on media type and content
        createdStory = calculateAndSetDuration(createdStory);
        createdStory = storyRepository.save(createdStory);
        
        return createdStory;
    }

    /**
     * Get feed stories (from current user + friends)
     * - Only active stories
     * - Created within 24h OR archived
     * - Respects privacy settings
     */
    @Override
    @Transactional(readOnly = true)
    public Page<Story> getFeedStories(List<String> userIds, String currentUserId, Pageable pageable) {
        log.info("Fetching feed for users: {} with currentUserId: {}", userIds, currentUserId);
        
        Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
        
        String queryUserId = currentUserId != null ? currentUserId : "";
        Page<Story> stories = storyRepository.findFeedStories(userIds, StatusType.ACTIVE, twentyFourHoursAgo, queryUserId, pageable);
        log.info("Found {} feed stories", stories.getTotalElements());
        
        return stories;
    }

    /**
     * Get user's stories (for profile view)
     * - If owner: return all stories
     * - If not owner: return only recent (24h) or archived
     */
    @Override
    @Transactional(readOnly = true)
    public List<Story> getUserStories(String userId, String currentUserId) {
        Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
        if (userId.equals(currentUserId)) {
            // Owner: get active stories within 24 hours (excludes soft-deleted and expired)
            log.info("Owner fetching active stories for user: {}", userId);
            return storyRepository.findByUserIdAndStatusAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                    userId, StatusType.ACTIVE, twentyFourHoursAgo
            );
        } else {
            // Not owner: check friendship
            boolean areFriends = false;
            if (currentUserId != null) {
                try {
                    areFriends = friendRepository.existsAcceptedFriendship(
                            Long.parseLong(userId),
                            Long.parseLong(currentUserId),
                            1
                    );
                } catch (Exception e) {
                    log.warn("Failed to check friendship between {} and {}", userId, currentUserId, e);
                }
            }

            if (areFriends) {
                log.info("Friend fetching active stories for user: {}", userId);
                return storyRepository.findUserStoriesFriends(userId, StatusType.ACTIVE, twentyFourHoursAgo);
            } else {
                log.info("Non-owner non-friend fetching public active stories for user: {}", userId);
                return storyRepository.findUserStoriesPublic(userId, StatusType.ACTIVE, twentyFourHoursAgo);
            }
        }
    }

    /**
     * Record a story view
     * - Prevent duplicate views using unique index on (storyId, viewerId)
     * - If new view, increment viewCount
     * - Return true if new view, false if duplicate
     */
    @Override
    @Transactional
    public boolean recordView(String storyId, String viewerId) {
        log.info("[recordView] storyId={}, viewerId={}", storyId, viewerId);
        
        // 1. Fetch story
        Optional<Story> storyOpt = storyRepository.findById(storyId);
        if (storyOpt.isEmpty()) {
            log.warn("[recordView] Story not found: {}", storyId);
            return false;
        }
        
        String storyOwnerId = storyOpt.get().getUserId();
        
        // 2. Check if already viewed - use List to handle legacy duplicates gracefully
        List<StoryView> existingViews = storyViewRepository.findByStoryIdAndViewerId(storyId, viewerId);
        
        // Clean up duplicates if they exist (keep only the first one)
        if (existingViews.size() > 1) {
            log.warn("[recordView] Found {} duplicate views for storyId={}, viewerId={} - cleaning up", existingViews.size(), storyId, viewerId);
            for (int i = 1; i < existingViews.size(); i++) {
                storyViewRepository.deleteById(existingViews.get(i).getId());
            }
        }
        
        if (!existingViews.isEmpty()) {
            log.info("[recordView] Already viewed storyId={}, viewerId={}", storyId, viewerId);
            return false;
        }

        try {
            // Create new view record
            StoryView view = StoryView.builder()
                    .storyId(storyId)
                    .viewerId(viewerId)
                    .createdAt(Instant.now())
                    .build();
            
            storyViewRepository.save(view);
            log.info("[recordView] Saved new view for storyId={}, viewerId={}", storyId, viewerId);
            
            // Increment viewCount only if the viewer is not the owner
            if (!storyOwnerId.equals(viewerId)) {
                incrementViewCount(storyId);
            }
            
            return true;
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // Race condition: another thread already inserted this view
            log.info("[recordView] Concurrent duplicate detected for storyId={}, viewerId={}", storyId, viewerId);
            return false;
        } catch (Exception e) {
            log.error("[recordView] Failed to save view: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Get viewers of a story (sorted by latest first)
     */
    @Override
    @Transactional(readOnly = true)
    public List<StoryView> getStoryViewers(String storyId) {
        List<StoryView> views = storyViewRepository.findByStoryIdOrderByCreatedAtDesc(storyId);
        log.info("[getStoryViewers] storyId={}, found {} views", storyId, views.size());
        return views;
    }

    @Override
    @Transactional
    public void reactToStory(String storyId, String viewerId, String emoji) {
        log.info("Recording reaction for story: {} by user: {} with emoji: {}", storyId, viewerId, emoji);
        
        // 1. Save or update in the generic 'reactions' collection
        try {
            ReactionType reactionType = getReactionTypeFromEmoji(emoji);
            Optional<Reaction> genericReactionOpt = reactionRepository.findByUserIdAndTargetTypeAndTargetId(
                    viewerId, TargetType.STORY, storyId
            );
            if (genericReactionOpt.isPresent()) {
                Reaction reaction = genericReactionOpt.get();
                reaction.setType(reactionType);
                reaction.setUpdatedAt(Instant.now());
                reactionRepository.save(reaction);
            } else {
                Reaction reaction = new Reaction();
                reaction.setUserId(viewerId);
                reaction.setTargetType(TargetType.STORY);
                reaction.setTargetId(storyId);
                reaction.setType(reactionType);
                reaction.setCreatedAt(Instant.now());
                reaction.setUpdatedAt(Instant.now());
                reactionRepository.save(reaction);
            }
        } catch (Exception e) {
            log.error("Failed to save to generic reactions collection: {}", e.getMessage(), e);
        }

        // 2. Find existing view or create one
        List<StoryView> existingViews = storyViewRepository.findByStoryIdAndViewerId(storyId, viewerId);
        if (!existingViews.isEmpty()) {
            StoryView view = existingViews.get(0);
            if (view.getReaction() == null) {
                incrementReactCount(storyId);
            }
            view.setReaction(emoji);
            storyViewRepository.save(view);
            
            // Clean up duplicates
            for (int i = 1; i < existingViews.size(); i++) {
                storyViewRepository.deleteById(existingViews.get(i).getId());
            }
        } else {
            StoryView newView = StoryView.builder()
                    .storyId(storyId)
                    .viewerId(viewerId)
                    .createdAt(Instant.now())
                    .reaction(emoji)
                    .build();
            storyViewRepository.save(newView);
            
            Optional<Story> storyOpt = storyRepository.findById(storyId);
            if (storyOpt.isPresent() && !storyOpt.get().getUserId().equals(viewerId)) {
                incrementViewCount(storyId);
            }
            incrementReactCount(storyId);
        }
    }

    private ReactionType getReactionTypeFromEmoji(String emoji) {
        if (emoji == null) return ReactionType.LIKE;
        switch (emoji) {
            case "❤️": return ReactionType.LOVE;
            case "😂": return ReactionType.HAHA;
            case "😮": return ReactionType.WOW;
            case "😢": return ReactionType.SAD;
            case "🔥": return ReactionType.WOW;
            case "👏": return ReactionType.LIKE;
            default: return ReactionType.LIKE;
        }
    }

    /**
     * Archive story (add to highlights)
     * - Set isArchived = true
     * - Set name for highlight category
     * - IMPORTANT: DO NOT update expireAt (already set from creation)
     */
    @Override
    @Transactional
    public Story archiveStory(String storyId, String highlightCategory) {
        log.info("Archiving story {} to highlight: {}", storyId, highlightCategory);
        
        Optional<Story> storyOpt = storyRepository.findById(storyId);
        if (storyOpt.isEmpty()) {
            throw new IllegalArgumentException("Story not found: " + storyId);
        }

        Story story = storyOpt.get();
        story.setArchived(true);
        story.setHighlightCategory(highlightCategory);
        
        // DO NOT change expireAt when archiving
        Story saved = storyRepository.save(story);
        log.info("Story archived successfully: {}", storyId);
        
        return saved;
    }

    /**
     * Remove story from highlights (unarchive)
     */
    @Override
    @Transactional
    public Story unarchiveStory(String storyId) {
        log.info("Unarchiving story: {}", storyId);
        
        Optional<Story> storyOpt = storyRepository.findById(storyId);
        if (storyOpt.isEmpty()) {
            throw new IllegalArgumentException("Story not found: " + storyId);
        }

        Story story = storyOpt.get();
        story.setArchived(false);
        story.setHighlightCategory(null);
        
        Story saved = storyRepository.save(story);
        log.info("Story unarchived: {}", storyId);
        
        return saved;
    }

    /**
     * Soft delete story
     */
    @Override
    @Transactional
    public void deleteStory(String storyId) {
        log.info("Deleting story: {}", storyId);
        
        Optional<Story> storyOpt = storyRepository.findById(storyId);
        if (storyOpt.isEmpty()) {
            throw new IllegalArgumentException("Story not found: " + storyId);
        }

        Story story = storyOpt.get();
        story.setStatus(StatusType.DELETED);
        storyRepository.save(story);
        
        log.info("Story soft-deleted: {}", storyId);
    }

    /**
     * Check if user can view story
     * - Owner can always view
     * - Privacy settings
     * - Not deleted
     */
    @Override
    public boolean canViewStory(Story story, String requesterId) {
        log.info("[canViewStory] Checking storyId={}, ownerId={}, requesterId={}, status={}, privacy={}, createdAt={}", 
            story.getId(), story.getUserId(), requesterId, story.getStatus(), story.getPrivacy(), story.getCreatedAt());

        // Must be active (not deleted)
        if (story.getStatus() != StatusType.ACTIVE) {
            log.warn("[canViewStory] Story is not ACTIVE: status={}", story.getStatus());
            return false;
        }

        // Owner can view
        if (story.getUserId().equals(requesterId)) {
            log.info("[canViewStory] Requester is owner - access granted");
            return true;
        }

        // Check if story is still active/valid (within 24h or archived)
        Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
        if (story.getCreatedAt().isBefore(twentyFourHoursAgo) && !story.isArchived()) {
            log.warn("[canViewStory] Story is expired and not archived: createdAt={}, twentyFourHoursAgo={}", story.getCreatedAt(), twentyFourHoursAgo);
            return false; // Expired and not archived
        }

        // Check privacy
        if (story.getPrivacy() == null || story.getPrivacy() == PrivacyType.PUBLIC) {
            log.info("[canViewStory] Story is PUBLIC or null privacy - access granted");
            return true;
        }

        if (story.getPrivacy() == PrivacyType.FRIENDS) {
            if (requesterId == null) {
                log.warn("[canViewStory] Requester ID is null for FRIENDS story");
                return false;
            }
            try {
                boolean areFriends = friendRepository.existsAcceptedFriendship(
                        Long.parseLong(story.getUserId()),
                        Long.parseLong(requesterId),
                        1
                );
                log.info("[canViewStory] Friendship check between {} and {}: {}", story.getUserId(), requesterId, areFriends);
                return areFriends;
            } catch (Exception e) {
                log.warn("[canViewStory] Failed to check friendship", e);
                return false;
            }
        }

        log.warn("[canViewStory] Story privacy is restricted: {}", story.getPrivacy());
        // ONLY_ME / PRIVATE or other restricted privacy levels
        return false;
    }

    /**
     * Get story by ID (for API)
     */
    @Override
    @Transactional(readOnly = true)
    public Optional<Story> getStory(String storyId) {
        return storyRepository.findByIdAndStatus(storyId, StatusType.ACTIVE);
    }

    /**
     * Get highlighted stories for user
     */
    @Override
    @Transactional(readOnly = true)
    public List<Story> getHighlights(String userId) {
        log.info("Fetching highlights for user: {}", userId);
        return storyRepository.findByUserIdAndIsArchivedTrue(userId);
    }

    /**
     * Check story existence and ownership
     */
    @Override
    public boolean isStoryOwner(String storyId, String userId) {
        Optional<Story> story = storyRepository.findById(storyId);
        return story.isPresent() && story.get().getUserId().equals(userId);
    }

    /**
     * Save story to repository
     */
    @Override
    @Transactional
    public Story saveStory(Story story, String userId) {
        return storyRepository.save(story);
    }

    /**
     * Check if user has at least one active story (within 24h)
     */
    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveStory(String userId) {
        Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
        return storyRepository.existsByUserIdAndStatusAndCreatedAtGreaterThanEqual(
                userId, StatusType.ACTIVE, twentyFourHoursAgo
        );
    }

    /**
     * Calculate and set story duration based on media type and content
     */
    @Override
    @Transactional
    public Story calculateAndSetDuration(Story story) {
        if (story == null) {
            log.warn("Cannot calculate duration for null story");
            return story;
        }

        long duration = durationCalculator.calculateDuration(story);
        story.setDuration_ms(duration);
        
        log.info("Calculated duration for story {}: {} ms", story.getId(), duration);
        return story;
    }

    /**
     * Increment view count atomically for a story
     */
    private void incrementViewCount(String storyId) {
        Query query = Query.query(Criteria.where("_id").is(storyId));
        Update update = new Update().inc("stats.viewCount", 1);
        mongoTemplate.updateFirst(query, update, Story.class);
    }

    /**
     * Increment react count atomically for a story
     */
    private void incrementReactCount(String storyId) {
        Query query = Query.query(Criteria.where("_id").is(storyId));
        Update update = new Update().inc("stats.reactCount", 1);
        mongoTemplate.updateFirst(query, update, Story.class);
    }



    /**
     * Detect media type from file extension
     */
    private String getMediaType(String extension) {
        if (extension == null) return "FILE";
        switch (extension.toLowerCase()) {
            case "jpg":
            case "jpeg":
            case "png":
            case "gif":
            case "webp":
                return "IMAGE";
            case "mp4":
            case "webm":
            case "mov":
            case "avi":
            case "mkv":
                return "VIDEO";
            case "mp3":
            case "wav":
            case "m4a":
            case "flac":
                return "AUDIO";
            default:
                return "FILE";
        }
    }

    /**
     * Create story in MongoDB (internal helper)
     * - If isArchived = true, DON'T set expireAt (story lives forever)
     * - If isArchived = false, set expireAt = now + 24h
     */
    @Transactional
    private Story createStoryInternal(Story story, String userId) {
        log.info("Creating story for user: {}", userId);
        
        story.setUserId(userId);
        story.setStatus(StatusType.ACTIVE);
        story.setCreatedAt(Instant.now());
        
        // Initialize stats (shared with Post)
        story.setStats(Stats.builder()
                .viewCount(0)
                .reactCount(0)
                .shareCount(0)
                .commentCount(0)
                .build());
        
        // Initialize reply count (specific to stories)
        story.setReplyCount(0);

        // Set expireAt only if NOT archived
        if (!story.isArchived()) {
            story.setExpireAt(Instant.now().plusSeconds(STORY_VALID_DURATION_HOURS * 3600));
            log.info("Story will expire at: {}", story.getExpireAt());
        } else {
            log.info("Story is archived - no expiration");
        }

        Story saved = storyRepository.save(story);
        log.info("Story created with ID: {}", saved.getId());
        return saved;
    }
}
