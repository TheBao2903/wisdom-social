package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.domain.entity.nosql.Story;
import iuh.fit.edu.backend.domain.entity.nosql.StoryView;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.story.CreateStoryRequest;
import iuh.fit.edu.backend.dto.response.story.StoryResponse;
import iuh.fit.edu.backend.service.story.StoryService;
import iuh.fit.edu.backend.service.story.StoryEventPublisher;
import iuh.fit.edu.backend.service.s3.S3Service;
import iuh.fit.edu.backend.service.note.NotePermissionService;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Story Controller - REST endpoints for story management
 * - Create and manage stories (24h visible + archives)
 * - View tracking and counters
 * - Reactions and interactions
 * - Feed generation
 */
@RestController
@RequestMapping("/api/stories")
@RequiredArgsConstructor
@Slf4j
public class StoryController {

    private final StoryService storyService;
    private final StoryEventPublisher eventPublisher;
    private final NotePermissionService permissionService;
    private final UserRepository userRepository;
    private final S3Service s3Service;

    /**
     * GET current user ID from JWT token
     */
    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null) {
            throw new IllegalStateException("User not authenticated");
        }

        String phoneNumber = principal.toString();
        
        // Normalize phone number (JWT provides +84xxx, DB stores 0xxx)
        if (phoneNumber.startsWith("+84")) {
            phoneNumber = "0" + phoneNumber.substring(3);
        }

        User user = userRepository.findByPhone(phoneNumber);
        if (user == null) {
            log.error("User not found for phone: {}", phoneNumber);
            throw new IllegalStateException("User not found: " + phoneNumber);
        }

        return user.getId().toString();
    }

    /**
     * GET /api/stories/upload-url - Get presigned upload URL for story media
     */
    @GetMapping("/upload-url")
    public ResponseEntity<Map<String, String>> getPresignedUploadUrl(
            @RequestParam String extension) {
        try {
            getCurrentUserId(); // Verify user is authenticated
            Map<String, String> uploadUrl = s3Service.generateUploadUrl("stories", extension);
            return ResponseEntity.ok(uploadUrl);
        } catch (Exception e) {
            log.error("Error getting presigned URL", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * POST /api/stories - Create new story with media (presigned URLs)
     * 
     * Form-data parameters:
     *   - content: story text content
     *   - privacy: PUBLIC/FRIENDS/PRIVATE
     *   - mediaUrls: S3 URLs from presigned upload (optional)
     */
    @PostMapping
    public ResponseEntity<StoryResponse> createStory(
            @RequestParam(required = false) String content,
            @RequestParam(required = false, defaultValue = "PUBLIC") String privacy,
            @RequestParam(required = false) List<String> mediaUrls) {
        try {
            String currentUserId = getCurrentUserId();
            log.info("Creating story for user: {}", currentUserId);

            // Parse privacy enum
            iuh.fit.edu.backend.constant.PrivacyType privacyType;
            try {
                privacyType = iuh.fit.edu.backend.constant.PrivacyType.valueOf(privacy.toUpperCase());
            } catch (IllegalArgumentException e) {
                privacyType = iuh.fit.edu.backend.constant.PrivacyType.PUBLIC;
            }

            // Create story object
            Story story = Story.builder()
                    .media(null)
                    .text(content)
                    .textStyle(null)
                    .music(null)
                    .stickers(new ArrayList<>())
                    .privacy(privacyType)
                    .allowReplies(true)
                    .allowReactions(true)
                    .allowSharing(true)
                    .isArchived(false)
                    .build();

            // Pass to service which handles S3 URL move
            story = storyService.createStory(story, currentUserId, mediaUrls);

            StoryResponse response = mapToResponse(story);
            
            // Publish NEW_STORY event to feed
            eventPublisher.publishNewStory(story, response);
            
            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (IOException e) {
            log.error("Media URL move error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (Exception e) {
            log.error("Error creating story: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/stories/feed - Get stories from current user and friends
     */
    @GetMapping("/feed")
    public ResponseEntity<Page<StoryResponse>> getFeed(Pageable pageable) {
        try {
            String currentUserId = getCurrentUserId();
            log.info("Fetching feed for user: {}", currentUserId);

            // Get current user's story + friends' stories
            List<String> userIds = new ArrayList<>();
            userIds.add(currentUserId);
            
            // TODO: Add friend IDs here (query from Friend repository)
            // List<String> friendIds = friendRepository.findAcceptedFriendIds(currentUserId);
            // userIds.addAll(friendIds);

            Page<Story> stories = storyService.getFeedStories(userIds, pageable);
            Page<StoryResponse> responses = stories.map(this::mapToResponse);

            return ResponseEntity.ok(responses);

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error fetching feed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/stories/user/{userId} - Get user's stories (public or all if owner)
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<StoryResponse>> getUserStories(@PathVariable String userId) {
        try {
            String currentUserId = getCurrentUserId();
            log.info("Fetching stories for user: {} by requester: {}", userId, currentUserId);

            List<Story> stories = storyService.getUserStories(userId, currentUserId);
            List<StoryResponse> responses = stories.stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(responses);

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error fetching user stories: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/stories/{storyId} - Get story detail
     */
    @GetMapping("/{storyId}")
    public ResponseEntity<StoryResponse> getStory(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();
            
            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isEmpty()) {
                log.warn("Story not found: {}", storyId);
                return ResponseEntity.notFound().build();
            }

            Story story = storyOpt.get();

            // Check permission to view
            if (!storyService.canViewStory(story, currentUserId)) {
                // Additional check: are they friends?
                if (story.getPrivacy() != iuh.fit.edu.backend.constant.PrivacyType.PUBLIC) {
                    if (!permissionService.areFriends(Long.parseLong(story.getUserId()), Long.parseLong(currentUserId))) {
                        log.warn("Access denied to story: {} for user: {}", storyId, currentUserId);
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                    }
                }
            }

            return ResponseEntity.ok(mapToResponse(story));

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error fetching story: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/stories/{storyId}/view - Record a view
     */
    @PostMapping("/{storyId}/view")
    public ResponseEntity<Void> viewStory(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();
            log.info("Recording view for story: {} by user: {}", storyId, currentUserId);

            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Story story = storyOpt.get();

            // Check permission
            if (!storyService.canViewStory(story, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            // Record view (won't increment if duplicate)
            boolean isNewView = storyService.recordView(storyId, currentUserId);
            
            // Publish STORY_VIEW event only if new view was recorded
            if (isNewView) {
                long newViewCount = (story.getStats() != null ? story.getStats().getViewCount() : 0) + 1;
                eventPublisher.publishStoryView(storyId, currentUserId, (int) newViewCount, story.getUserId());
            }

            return ResponseEntity.ok().build();

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error recording view: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/stories/{storyId}/viewers - Get list of viewers
     */
    @GetMapping("/{storyId}/viewers")
    public ResponseEntity<List<Map<String, Object>>> getViewers(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();

            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            // Only owner can see viewers list
            Story story = storyOpt.get();
            if (!story.getUserId().equals(currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            List<StoryView> viewers = storyService.getStoryViewers(storyId);
            List<Map<String, Object>> response = viewers.stream()
                    .map(view -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("viewerId", view.getViewerId());
                        map.put("viewedAt", view.getCreatedAt());
                        return map;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error fetching viewers: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/stories/{storyId}/react - Add reaction
     */
    @PostMapping("/{storyId}/react")
    public ResponseEntity<Void> reactStory(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();

            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Story story = storyOpt.get();
            if (!story.isAllowReactions()) {
                log.warn("Reactions disabled for story: {}", storyId);
                return ResponseEntity.badRequest().build();
            }

            // Permission check
            if (!storyService.canViewStory(story, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            storyService.reactToStory(storyId);
            
            // Publish STORY_REACTION event
            // Note: We need to fetch updated story to get new reaction count
            Optional<Story> updatedStory = storyService.getStory(storyId);
            if (updatedStory.isPresent()) {
                long reactCount = (updatedStory.get().getStats() != null ? updatedStory.get().getStats().getReactCount() : 0);
                eventPublisher.publishStoryReaction(storyId, currentUserId, (int) reactCount, story.getUserId());
            }
            
            return ResponseEntity.ok().build();

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error recording reaction: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/stories/{storyId}/highlight - Add to highlights with category
     */
    @PostMapping("/{storyId}/highlight")
    public ResponseEntity<StoryResponse> highlightStory(
            @PathVariable String storyId,
            @RequestBody Map<String, String> request) {
        try {
            String currentUserId = getCurrentUserId();

            if (!storyService.isStoryOwner(storyId, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            String category = request.get("category");
            if (category == null || category.isBlank()) {
                return ResponseEntity.badRequest().build();
            }

            Story updated = storyService.archiveStory(storyId, category);
            
            // Publish STORY_ARCHIVED event
            eventPublisher.publishStoryArchived(storyId, currentUserId, category);
            
            return ResponseEntity.ok(mapToResponse(updated));

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error archiving story: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * DELETE /api/stories/{storyId}/highlight - Remove from highlights
     */
    @DeleteMapping("/{storyId}/highlight")
    public ResponseEntity<StoryResponse> removeHighlight(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();

            if (!storyService.isStoryOwner(storyId, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            Story updated = storyService.unarchiveStory(storyId);
            
            // Publish STORY_UNARCHIVED event
            eventPublisher.publishStoryUnarchived(storyId, currentUserId);
            
            return ResponseEntity.ok(mapToResponse(updated));

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error unarchiving story: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * DELETE /api/stories/{storyId} - Delete story
     */
    @DeleteMapping("/{storyId}")
    public ResponseEntity<Void> deleteStory(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();

            if (!storyService.isStoryOwner(storyId, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            storyService.deleteStory(storyId);
            
            // Publish STORY_DELETED event
            eventPublisher.publishStoryDeleted(storyId, currentUserId);
            
            return ResponseEntity.noContent().build();

        } catch (IllegalStateException e) {
            log.error("Authentication error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error deleting story: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Map Story entity to response DTO
     */
    private StoryResponse mapToResponse(Story story) {
        return StoryResponse.builder()
                .id(story.getId())
                .userId(story.getUserId())
                .media(story.getMedia())
                .text(story.getText())
                .textStyle(story.getTextStyle())
                .music(story.getMusic())
                .stickers(story.getStickers())
                .privacy(story.getPrivacy())
                .allowReplies(story.isAllowReplies())
                .allowReactions(story.isAllowReactions())
                .allowSharing(story.isAllowSharing())
                .viewCount((int) (story.getStats() != null ? story.getStats().getViewCount() : 0))
                .reactCount((int) (story.getStats() != null ? story.getStats().getReactCount() : 0))
                .replyCount((int) story.getReplyCount())
                .shareCount((int) (story.getStats() != null ? story.getStats().getShareCount() : 0))
                .isArchived(story.isArchived())
                .highlightCategory(story.getHighlightCategory())
                .createdAt(story.getCreatedAt())
                .expireAt(story.getExpireAt())
                .build();
    }
}
