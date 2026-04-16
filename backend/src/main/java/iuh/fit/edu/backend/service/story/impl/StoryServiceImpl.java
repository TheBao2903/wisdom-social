package iuh.fit.edu.backend.service.story.impl;

import iuh.fit.edu.backend.constant.PrivacyType;
import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.nosql.Story;
import iuh.fit.edu.backend.domain.entity.nosql.StoryView;
import iuh.fit.edu.backend.domain.entity.nosql.Stats;
import iuh.fit.edu.backend.repository.nosql.StoryRepository;
import iuh.fit.edu.backend.repository.nosql.StoryViewRepository;
import iuh.fit.edu.backend.service.s3.S3Service;
import iuh.fit.edu.backend.service.story.StoryService;
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
    private final MongoTemplate mongoTemplate;
    private final S3Service s3Service;
    
    private static final long STORY_VALID_DURATION_HOURS = 24;

    /**
     * Create a new story with file uploads
     * - First creates story in MongoDB to get ID
     * - Then uploads media files to S3
     * - Finally updates story with media URLs
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
                String finalUrl = s3Service.moveUploadUrl("stories", Long.parseLong(createdStory.getId()), tempUrl);
                
                // Detect media type from file extension
                String extension = tempUrl.substring(tempUrl.lastIndexOf(".") + 1).toLowerCase();
                String mediaType = getMediaType(extension);
                
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
    public Page<Story> getFeedStories(List<String> userIds, Pageable pageable) {
        log.info("Fetching feed for users: {}", userIds);
        
        Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
        
        Page<Story> stories = storyRepository.findFeedStories(userIds, twentyFourHoursAgo, pageable);
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
        if (userId.equals(currentUserId)) {
            // Owner: get all stories
            log.info("Owner fetching all stories for user: {}", userId);
            return storyRepository.findByUserIdOrderByCreatedAtDesc(userId);
        } else {
            // Not owner: get only public recent or archived
            log.info("Non-owner fetching public stories for user: {}", userId);
            Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
            return storyRepository.findUserStoriesPublic(userId, twentyFourHoursAgo);
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
        log.info("Recording view for story: {} by user: {}", storyId, viewerId);
        
        // Check if already viewed
        Optional<StoryView> existing = storyViewRepository.findByStoryIdAndViewerId(storyId, viewerId);
        if (existing.isPresent()) {
            log.info("Duplicate view detected - skipping");
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
            
            // Increment viewCount atomically
            incrementViewCount(storyId);
            log.info("View recorded successfully for story: {}", storyId);
            
            return true;
        } catch (Exception e) {
            log.warn("View recording failed (duplicate?): {}", e.getMessage());
            return false;
        }
    }

    /**
     * Get viewers of a story (sorted by latest first)
     */
    @Override
    @Transactional(readOnly = true)
    public List<StoryView> getStoryViewers(String storyId) {
        log.info("Fetching viewers for story: {}", storyId);
        return storyViewRepository.findByStoryIdOrderByCreatedAtDesc(storyId);
    }

    /**
     * Add reaction to story
     */
    @Override
    @Transactional
    public void reactToStory(String storyId) {
        log.info("Recording reaction for story: {}", storyId);
        incrementReactCount(storyId);
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
        // Must be active (not deleted)
        if (story.getStatus() != StatusType.ACTIVE) {
            return false;
        }

        // Owner can view
        if (story.getUserId().equals(requesterId)) {
            return true;
        }

        // Check if story is still public (within 24h or archived)
        Instant twentyFourHoursAgo = Instant.now().minusSeconds(STORY_VALID_DURATION_HOURS * 3600);
        if (story.getCreatedAt().isBefore(twentyFourHoursAgo) && !story.isArchived()) {
            return false; // Expired and not archived
        }

        // Check privacy
        if (story.getPrivacy() == PrivacyType.PUBLIC) {
            return true;
        }

        // FRIENDS and PRIVATE require friend verification (implement in controller)
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
