package iuh.fit.edu.backend.modules.story.controller;

import iuh.fit.edu.backend.modules.story.entity.Story;
import iuh.fit.edu.backend.modules.story.entity.StoryHighlight;
import iuh.fit.edu.backend.modules.story.entity.StoryView;
import iuh.fit.edu.backend.modules.story.repository.StoryHighlightRepository;
import iuh.fit.edu.backend.modules.story.dto.response.StoryHighlightResponse;

import iuh.fit.edu.backend.modules.story.repository.StoryRepository;
import iuh.fit.edu.backend.modules.story.repository.StoryViewRepository;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.story.dto.response.StoryResponse;
import iuh.fit.edu.backend.common.dto.response.PresignedUrlResponse;
import iuh.fit.edu.backend.common.constant.UploadModule;
import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.story.service.StoryService;
import iuh.fit.edu.backend.modules.story.service.StoryEventPublisher;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import iuh.fit.edu.backend.modules.music.service.MusicService;
import iuh.fit.edu.backend.modules.music.entity.MusicMetadata;
import iuh.fit.edu.backend.modules.music.entity.Music;
import iuh.fit.edu.backend.modules.note.service.NotePermissionService;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.modules.post.repository.ReactionRepository;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.entity.Stats;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

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
    private final MusicService musicService;
    private final StoryRepository storyRepository;
    private final FriendRepository friendRepository;
    private final StoryViewRepository storyViewRepository;
    private final ReactionRepository reactionRepository;
    private final StoryHighlightRepository storyHighlightRepository;

    @GetMapping("/debug/all-stories")
    public ResponseEntity<List<Story>> getDebugAllStories() {
        return ResponseEntity.ok(storyRepository.findAll());
    }

    @GetMapping("/debug/all-views")
    public ResponseEntity<List<StoryView>> getDebugAllViews() {
        return ResponseEntity.ok(storyViewRepository.findAll());
    }

    @GetMapping("/debug/all-users")
    public ResponseEntity<List<User>> getDebugAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

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
     * Uses UploadModule.STORY for all story media uploads
     * @param extension File extension (jpg, png, mp4, etc.)
     * @param originalFilename Original filename for validation
     * @param contentType MIME type (image/jpeg, video/mp4, etc.)
     * @return Presigned URL and S3 object key
     */
    @GetMapping("/upload-url")
    public ResponseEntity<PresignedUrlResponse> getPresignedUploadUrl(
            @RequestParam String extension,
            @RequestParam(required = false) String originalFilename,
            @RequestParam(required = false) String contentType) {
        try {
            String currentUserId = getCurrentUserId();
            
            // Determine content type based on extension if not provided
            if (contentType == null || contentType.isBlank()) {
                contentType = getContentType(extension);
            }

            String filename = originalFilename != null ? originalFilename : "story." + extension;
            
            PresignedUrlResponse response = s3Service.generatePresignedUrl(
                    UploadModule.STORY,
                    currentUserId,
                    getMediaType(extension),
                    filename,
                    contentType
            );
            
            log.info("Generated presigned URL for story upload: {}", response.getObjectKey());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid file: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (Exception e) {
            log.error("Error getting presigned URL", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * Determine media type (IMAGE, VIDEO, FILE) based on extension
     */
    private String getMediaType(String extension) {
        if (extension == null) return "FILE";
        String ext = extension.toLowerCase();
        
        if (ext.matches("jpg|jpeg|png|gif|webp")) {
            return "IMAGE";
        } else if (ext.matches("mp4|webm|mov|avi|mkv")) {
            return "VIDEO";
        }
        return "FILE";
    }

    /**
     * Get MIME type based on extension
     */
    private String getContentType(String extension) {
        if (extension == null) return "application/octet-stream";
        
        return switch (extension.toLowerCase()) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "mov" -> "video/quicktime";
            case "avi" -> "video/x-msvideo";
            case "mkv" -> "video/x-matroska";
            default -> "application/octet-stream";
        };
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
            @RequestParam(required = false) List<String> mediaUrls,
            @RequestParam(required = false) String musicId,
            @RequestParam(required = false) Integer musicStartTime,
            @RequestParam(required = false) Boolean muteOriginal,
            @RequestParam(required = false) String text_layers,
            @RequestParam(required = false) String music_stickers) {
        try {
            String currentUserId = getCurrentUserId();
            log.info("Creating story for user: {} with music: {}, muteOriginal: {}", currentUserId, musicId, muteOriginal);

            // Parse privacy enum
            PrivacyType privacyType;
            try {
                privacyType = PrivacyType.valueOf(privacy.toUpperCase());
            } catch (IllegalArgumentException e) {
                privacyType = PrivacyType.PUBLIC;
            }

            // Fetch and set music if present
            Music storyMusic = null;
            if (musicId != null && !musicId.isBlank()) {
                Optional<MusicMetadata> metadataOpt = musicService.getMusicById(musicId);
                if (metadataOpt.isPresent()) {
                    MusicMetadata meta = metadataOpt.get();
                    storyMusic = Music.builder()
                            .trackId(meta.getId())
                            .startTime(musicStartTime != null ? musicStartTime : 0)
                            .title(meta.getTitle())
                            .artist(meta.getArtist())
                            .thumbnail(meta.getImageUrl())
                            .audioUrl(meta.getAudioUrl())
                            .duration(meta.getDuration() != null ? meta.getDuration().longValue() : 0L)
                            .muteOriginal(muteOriginal != null ? muteOriginal : false)
                            .originalVolume(muteOriginal != null && muteOriginal ? 0 : 100)
                            .musicVolume(100)
                            .build();
                    log.info("Found music metadata for story: title={}", meta.getTitle());
                }
            }

            if (storyMusic == null && muteOriginal != null) {
                storyMusic = Music.builder()
                        .muteOriginal(muteOriginal)
                        .originalVolume(muteOriginal ? 0 : 100)
                        .musicVolume(100)
                        .build();
            }

            // Create story object
            // Parse text_layers from request parameter if provided
            List<iuh.fit.edu.backend.modules.story.entity.TextLayer> textLayers = new ArrayList<>();
            
            if (text_layers != null && !text_layers.isBlank()) {
                // Parse JSON text_layers from frontend
                try {
                    Gson gson = new Gson();
                    JsonArray layersArray = gson.fromJson(text_layers, JsonArray.class);
                    
                    for (int i = 0; i < layersArray.size(); i++) {
                        JsonObject layerObj = layersArray.get(i).getAsJsonObject();
                        
                        // Parse style object
                        JsonObject styleObj = layerObj.has("style") ? layerObj.getAsJsonObject("style") : new JsonObject();
                        
                        iuh.fit.edu.backend.modules.story.entity.TextLayer.TextStyle style = 
                            iuh.fit.edu.backend.modules.story.entity.TextLayer.TextStyle.builder()
                                .fontSize(styleObj.has("fontSize") ? styleObj.get("fontSize").getAsInt() : 16)
                                .fontFamily(styleObj.has("fontFamily") ? styleObj.get("fontFamily").getAsString() : "Arial")
                                .color(styleObj.has("color") ? styleObj.get("color").getAsString() : "#FFFFFF")
                                .align(styleObj.has("align") ? styleObj.get("align").getAsString() : "center")
                                .rotation(styleObj.has("rotation") ? styleObj.get("rotation").getAsFloat() : 0f)
                                .bold(styleObj.has("bold") ? styleObj.get("bold").getAsBoolean() : false)
                                .shadow(styleObj.has("shadow") ? styleObj.get("shadow").getAsBoolean() : false)
                                .build();
                        
                        iuh.fit.edu.backend.modules.story.entity.TextLayer layer = 
                            iuh.fit.edu.backend.modules.story.entity.TextLayer.builder()
                                .id(layerObj.has("id") ? layerObj.get("id").getAsString() : UUID.randomUUID().toString())
                                .content(layerObj.has("content") ? layerObj.get("content").getAsString() : "")
                                .x_pct(layerObj.has("x_pct") ? layerObj.get("x_pct").getAsFloat() : 0.5f)
                                .y_pct(layerObj.has("y_pct") ? layerObj.get("y_pct").getAsFloat() : 0.5f)
                                .width_pct(layerObj.has("width_pct") ? layerObj.get("width_pct").getAsFloat() : null)
                                .height_pct(layerObj.has("height_pct") ? layerObj.get("height_pct").getAsFloat() : null)
                                .style(style)
                                .z_index(layerObj.has("z_index") ? layerObj.get("z_index").getAsInt() : i)
                                .build();
                        
                        textLayers.add(layer);
                    }
                    
                    log.info("Parsed {} text layers from request", textLayers.size());
                } catch (Exception e) {
                    log.warn("Failed to parse text_layers JSON, falling back to content parameter: {}", e.getMessage());
                    // Fallback to content parameter
                    if (content != null && !content.isBlank()) {
                        String cleanText = content.replaceAll("\\[bg:.*?\\]", "").trim();
                        if (!cleanText.isEmpty()) {
                            textLayers.add(iuh.fit.edu.backend.modules.story.entity.TextLayer.builder()
                                    .id(UUID.randomUUID().toString())
                                    .content(cleanText)
                                    .x_pct(0.5f)
                                    .y_pct(0.5f)
                                    .style(iuh.fit.edu.backend.modules.story.entity.TextLayer.TextStyle.builder()
                                            .fontSize(16)
                                            .fontFamily("Arial")
                                            .color("#FFFFFF")
                                            .align("center")
                                            .build())
                                    .z_index(1)
                                    .build());
                        }
                    }
                }
            } else if (content != null && !content.isBlank()) {
                // Fallback: create text layer from content parameter only
                String cleanText = content.replaceAll("\\[bg:.*?\\]", "").trim();
                if (!cleanText.isEmpty()) {
                    textLayers.add(iuh.fit.edu.backend.modules.story.entity.TextLayer.builder()
                            .id(UUID.randomUUID().toString())
                            .content(cleanText)
                            .x_pct(0.5f)
                            .y_pct(0.5f)
                            .style(iuh.fit.edu.backend.modules.story.entity.TextLayer.TextStyle.builder()
                                    .fontSize(16)
                                    .fontFamily("Arial")
                                    .color("#FFFFFF")
                                    .align("center")
                                    .build())
                            .z_index(1)
                            .build());
                }
            }

            Story story = Story.builder()
                    .content(content)
                    .media(null)
                    .text_layers(textLayers)
                    .music_stickers(parseMusicStickers(music_stickers))
                    .music(storyMusic)
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
            
            List<Long> friendIds = friendRepository.findAcceptedFriendIds(Long.parseLong(currentUserId), 1);
            if (friendIds != null) {
                for (Long friendId : friendIds) {
                    userIds.add(friendId.toString());
                }
            }

            Page<Story> stories = storyService.getFeedStories(userIds, currentUserId, pageable);

            // Fetch viewed stories for the current user in a single optimized query
            List<String> storyIds = stories.getContent().stream()
                    .map(Story::getId)
                    .collect(Collectors.toList());
            Set<String> viewedStoryIds = new HashSet<>();
            if (!storyIds.isEmpty()) {
                viewedStoryIds = storyViewRepository.findByViewerIdAndStoryIdIn(currentUserId, storyIds).stream()
                        .map(StoryView::getStoryId)
                        .collect(Collectors.toSet());
            }

            final Set<String> finalViewedIds = viewedStoryIds;
            Page<StoryResponse> responses = stories.map(story -> {
                StoryResponse resp = mapToResponse(story);
                resp.setViewed(finalViewedIds.contains(story.getId()));
                return resp;
            });

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

            // Fetch viewed stories for the current user in a single optimized query
            List<String> storyIds = stories.stream()
                    .map(Story::getId)
                    .collect(Collectors.toList());
            Set<String> viewedStoryIds = new HashSet<>();
            if (!storyIds.isEmpty() && currentUserId != null) {
                viewedStoryIds = storyViewRepository.findByViewerIdAndStoryIdIn(currentUserId, storyIds).stream()
                        .map(StoryView::getStoryId)
                        .collect(Collectors.toSet());
            }

            final Set<String> finalViewedIds = viewedStoryIds;
            List<StoryResponse> responses = stories.stream()
                    .map(story -> {
                        StoryResponse resp = mapToResponse(story);
                        resp.setViewed(finalViewedIds.contains(story.getId()));
                        return resp;
                    })
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
     * GET /api/stories/user/{userId}/has-active - Check if user has active stories
     * Used for avatar story ring/border indicator
     */
    @GetMapping("/user/{userId}/has-active")
    public ResponseEntity<Map<String, Boolean>> hasActiveStory(@PathVariable String userId) {
        try {
            String currentUserId = getCurrentUserId();
            List<Story> activeStories = storyService.getUserStories(userId, currentUserId);
            boolean hasActive = !activeStories.isEmpty();
            boolean hasUnviewed = false;

            if (hasActive && currentUserId != null) {
                List<String> storyIds = activeStories.stream()
                        .map(Story::getId)
                        .collect(Collectors.toList());
                long viewCount = storyViewRepository.findByViewerIdAndStoryIdIn(currentUserId, storyIds).size();
                hasUnviewed = viewCount < activeStories.size();
            }

            return ResponseEntity.ok(Map.of(
                    "hasActiveStory", hasActive,
                    "hasUnviewedStory", hasUnviewed
            ));
        } catch (Exception e) {
            log.error("Error checking active story for user {}: {}", userId, e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "hasActiveStory", false,
                    "hasUnviewedStory", false
            ));
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
                if (story.getPrivacy() != PrivacyType.PUBLIC) {
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
            
            // Fetch reactions from generic reactions collection for this story
            Map<String, String> reactionMap = new HashMap<>();
            try {
                List<Reaction> storyReactions = reactionRepository.findByTargetTypeAndTargetId(TargetType.STORY, storyId);
                for (Reaction r : storyReactions) {
                    reactionMap.put(r.getUserId(), getEmojiFromReactionType(r.getType()));
                }
            } catch (Exception e) {
                log.error("Failed to fetch generic reactions for story: {}", storyId, e);
            }
            
            // Deduplicate by viewerId and filter out story owner
            String storyOwnerId = story.getUserId();
            Map<String, StoryView> uniqueViews = new LinkedHashMap<>();
            for (StoryView view : viewers) {
                String viewerId = view.getViewerId();
                if (viewerId.equals(storyOwnerId)) {
                    continue;
                }
                
                // Merge reaction from generic reactions collection
                String reactionEmoji = reactionMap.get(viewerId);
                if (reactionEmoji != null) {
                    view.setReaction(reactionEmoji);
                }
                
                if (uniqueViews.containsKey(viewerId)) {
                    StoryView existing = uniqueViews.get(viewerId);
                    // Keep the one with a reaction if available
                    if (existing.getReaction() == null && view.getReaction() != null) {
                        uniqueViews.put(viewerId, view);
                    }
                } else {
                    uniqueViews.put(viewerId, view);
                }
            }

            // Sync/update story viewCount in DB if it mismatches actual unique non-owner count
            int correctViewCount = uniqueViews.size();
            if (story.getStats() == null || story.getStats().getViewCount() != correctViewCount) {
                try {
                    if (story.getStats() == null) {
                        story.setStats(new Stats());
                    }
                    story.getStats().setViewCount(correctViewCount);
                    storyRepository.save(story);
                    log.info("🔔 [getViewers] Synchronized story viewCount in DB to {}", correctViewCount);
                } catch (Exception e) {
                    log.error("Failed to sync viewCount for story: {}", storyId, e);
                }
            }

            List<Map<String, Object>> response = uniqueViews.values().stream()
                    .map(view -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("viewerId", view.getViewerId());
                        map.put("viewedAt", view.getCreatedAt());
                        map.put("reaction", view.getReaction());

                        // Fetch user details for the viewer
                        try {
                            Long uid = Long.parseLong(view.getViewerId());
                            Optional<User> uOpt = userRepository.findById(uid);
                            if (uOpt.isPresent()) {
                                User u = uOpt.get();
                                map.put("username", u.getUsername() != null ? u.getUsername() : u.getName());
                                map.put("avatarUrl", u.getAvatarUrl());
                            }
                        } catch (Exception e) {
                            log.warn("Failed to fetch user details for viewer ID: {}", view.getViewerId(), e);
                        }

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

    private String getEmojiFromReactionType(ReactionType type) {
        if (type == null) return null;
        switch (type) {
            case LOVE: return "❤️";
            case HAHA: return "😂";
            case WOW: return "😮";
            case SAD: return "😢";
            case ANGRY: return "😡";
            case LIKE: return "👍";
            default: return "👍";
        }
    }

    /**
     * POST /api/stories/{storyId}/react - Add reaction
     */
    @PostMapping("/{storyId}/react")
    public ResponseEntity<Void> reactStory(
            @PathVariable String storyId,
            @RequestParam(required = false) String emoji) {
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

            storyService.reactToStory(storyId, currentUserId, emoji);
            
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
     * PUT /api/stories/{storyId}/privacy - Update story privacy level
     */
    @PutMapping("/{storyId}/privacy")
    public ResponseEntity<StoryResponse> updateStoryPrivacy(
            @PathVariable String storyId,
            @RequestParam String privacy) {
        try {
            String currentUserId = getCurrentUserId();

            if (!storyService.isStoryOwner(storyId, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Story story = storyOpt.get();
            try {
                story.setPrivacy(PrivacyType.valueOf(privacy.toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }

            Story updated = storyService.saveStory(story, currentUserId);
            return ResponseEntity.ok(mapToResponse(updated));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error updating story privacy: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * PUT /api/stories/{storyId}/settings - Update story advanced settings
     */
    @PutMapping("/{storyId}/settings")
    public ResponseEntity<StoryResponse> updateStorySettings(
            @PathVariable String storyId,
            @RequestParam(required = false) Boolean allowReplies,
            @RequestParam(required = false) Boolean allowReactions,
            @RequestParam(required = false) Boolean allowSharing) {
        try {
            String currentUserId = getCurrentUserId();

            if (!storyService.isStoryOwner(storyId, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Story story = storyOpt.get();
            if (allowReplies != null) story.setAllowReplies(allowReplies);
            if (allowReactions != null) story.setAllowReactions(allowReactions);
            if (allowSharing != null) story.setAllowSharing(allowSharing);

            Story updated = storyService.saveStory(story, currentUserId);
            return ResponseEntity.ok(mapToResponse(updated));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error updating story settings: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * DELETE /api/stories/{storyId} - Delete story
     * Also deletes associated media from S3
     */
    @DeleteMapping("/{storyId}")
    public ResponseEntity<Void> deleteStory(@PathVariable String storyId) {
        try {
            String currentUserId = getCurrentUserId();

            if (!storyService.isStoryOwner(storyId, currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            // Get story to retrieve media URL for S3 deletion
            Optional<Story> storyOpt = storyService.getStory(storyId);
            if (storyOpt.isPresent()) {
                Story story = storyOpt.get();
                // Story has single media object (not a list)
                if (story.getMedia() != null && story.getMedia().getUrl() != null) {
                    try {
                        s3Service.deleteByKey(UploadModule.STORY, story.getMedia().getUrl());
                        log.info("Deleted S3 media: {}", story.getMedia().getUrl());
                    } catch (Exception e) {
                        log.warn("Failed to delete S3 media {}: {}", story.getMedia().getUrl(), e.getMessage());
                        // Don't fail story deletion if S3 deletion fails
                    }
                }
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

    // ==========================================
    // STORY HIGHLIGHTS ENDPOINTS
    // ==========================================

    /**
     * POST /api/stories/highlights - Create a new highlight group
     * Body: { "title": "...", "storyIds": ["id1","id2",...], "coverImageUrl": "..." }
     * This will also set isArchived=true on selected stories so they won't expire
     */
    @PostMapping("/highlights")
    public ResponseEntity<StoryHighlightResponse> createHighlight(@RequestBody Map<String, Object> request) {
        try {
            String currentUserId = getCurrentUserId();
            
            String title = (String) request.get("title");
            if (title == null || title.isBlank()) {
                return ResponseEntity.badRequest().build();
            }
            
            @SuppressWarnings("unchecked")
            List<String> storyIds = (List<String>) request.get("storyIds");
            if (storyIds == null || storyIds.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            String coverImageUrl = (String) request.get("coverImageUrl");
            
            // Verify all stories belong to current user and archive them
            List<Story> stories = new ArrayList<>();
            for (String storyId : storyIds) {
                Optional<Story> storyOpt = storyRepository.findById(storyId);
                if (storyOpt.isEmpty()) {
                    log.warn("Story not found during highlight creation: {}", storyId);
                    continue;
                }
                Story story = storyOpt.get();
                if (!story.getUserId().equals(currentUserId)) {
                    log.warn("User {} tried to add story {} that belongs to {}", currentUserId, storyId, story.getUserId());
                    continue;
                }
                
                // Archive the story so it won't be deleted by TTL
                if (!story.isArchived()) {
                    story.setArchived(true);
                    story.setExpireAt(null); // Remove TTL
                    story.setHighlightCategory(title);
                    storyRepository.save(story);
                }
                stories.add(story);
            }
            
            if (stories.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            // Use cover from first story if not provided
            if (coverImageUrl == null || coverImageUrl.isBlank()) {
                Story firstStory = stories.get(0);
                if (firstStory.getMedia() != null) {
                    coverImageUrl = firstStory.getMedia().getThumbnailUrl() != null
                            ? firstStory.getMedia().getThumbnailUrl()
                            : firstStory.getMedia().getUrl();
                }
            }
            
            // Get next display order
            long count = storyHighlightRepository.countByUserId(currentUserId);
            
            StoryHighlight highlight = StoryHighlight.builder()
                    .userId(currentUserId)
                    .title(title)
                    .coverImageUrl(coverImageUrl)
                    .storyIds(stories.stream().map(Story::getId).collect(Collectors.toList()))
                    .displayOrder((int) count)
                    .viewCount(0)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            
            highlight = storyHighlightRepository.save(highlight);
            log.info("Created highlight '{}' with {} stories for user {}", title, stories.size(), currentUserId);
            
            StoryHighlightResponse response = mapToHighlightResponse(highlight);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
            
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error creating highlight: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/stories/highlights/user/{userId} - Get all highlights for a user
     */
    @GetMapping("/highlights/user/{userId}")
    public ResponseEntity<List<StoryHighlightResponse>> getUserHighlights(@PathVariable String userId) {
        try {
            List<StoryHighlight> highlights = storyHighlightRepository.findByUserIdOrderByDisplayOrderAsc(userId);
            
            List<StoryHighlightResponse> responses = highlights.stream()
                    .map(this::mapToHighlightResponse)
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(responses);
        } catch (Exception e) {
            log.error("Error fetching highlights for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * DELETE /api/stories/highlights/{highlightId} - Delete a highlight
     * Optionally unarchives stories that are no longer referenced by any other highlight.
     */
    @DeleteMapping("/highlights/{highlightId}")
    public ResponseEntity<Void> deleteHighlight(@PathVariable String highlightId) {
        try {
            String currentUserId = getCurrentUserId();
            
            Optional<StoryHighlight> highlightOpt = storyHighlightRepository.findById(highlightId);
            if (highlightOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            StoryHighlight highlight = highlightOpt.get();
            if (!highlight.getUserId().equals(currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            // Collect story IDs from this highlight
            List<String> storyIdsToCheck = highlight.getStoryIds() != null ? highlight.getStoryIds() : List.of();
            
            // Delete the highlight
            storyHighlightRepository.deleteById(highlightId);
            log.info("Deleted highlight '{}' ({}) for user {}", highlight.getTitle(), highlightId, currentUserId);
            
            // Unarchive stories that are no longer in ANY other highlight
            if (!storyIdsToCheck.isEmpty()) {
                List<StoryHighlight> remainingHighlights = storyHighlightRepository.findByUserId(currentUserId);
                Set<String> stillReferencedIds = remainingHighlights.stream()
                        .filter(h -> h.getStoryIds() != null)
                        .flatMap(h -> h.getStoryIds().stream())
                        .collect(Collectors.toSet());
                
                for (String storyId : storyIdsToCheck) {
                    if (!stillReferencedIds.contains(storyId)) {
                        storyRepository.findById(storyId).ifPresent(story -> {
                            if (story.getUserId().equals(currentUserId) && story.isArchived()) {
                                story.setArchived(false);
                                story.setHighlightCategory(null);
                                // Re-set TTL if story was originally 24h
                                if (story.getExpireAt() == null && story.getCreatedAt() != null) {
                                    story.setExpireAt(story.getCreatedAt().plusSeconds(86400));
                                }
                                storyRepository.save(story);
                                log.info("Unarchived story {} after highlight deletion", storyId);
                            }
                        });
                    }
                }
            }
            
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error deleting highlight: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * PUT /api/stories/highlights/{highlightId} - Update a highlight
     * Supports updating: title, coverImageUrl, storyIds (full replacement), displayOrder.
     * Automatically archives newly added stories and unarchives removed ones
     * (if they are no longer in any other highlight).
     */
    @PutMapping("/highlights/{highlightId}")
    public ResponseEntity<StoryHighlightResponse> updateHighlight(
            @PathVariable String highlightId,
            @RequestBody Map<String, Object> request) {
        try {
            String currentUserId = getCurrentUserId();
            
            Optional<StoryHighlight> highlightOpt = storyHighlightRepository.findById(highlightId);
            if (highlightOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            StoryHighlight highlight = highlightOpt.get();
            if (!highlight.getUserId().equals(currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            // Update title
            if (request.containsKey("title")) {
                String newTitle = (String) request.get("title");
                if (newTitle != null && !newTitle.isBlank()) {
                    highlight.setTitle(newTitle);
                }
            }
            
            // Update cover image
            if (request.containsKey("coverImageUrl")) {
                highlight.setCoverImageUrl((String) request.get("coverImageUrl"));
            }
            
            // Update display order
            if (request.containsKey("displayOrder")) {
                Object orderObj = request.get("displayOrder");
                if (orderObj instanceof Number) {
                    highlight.setDisplayOrder(((Number) orderObj).intValue());
                }
            }
            
            // Update story list (full replacement)
            if (request.containsKey("storyIds")) {
                @SuppressWarnings("unchecked")
                List<String> newStoryIds = (List<String>) request.get("storyIds");
                List<String> oldStoryIds = highlight.getStoryIds() != null ? highlight.getStoryIds() : List.of();
                
                // Find newly added stories and archive them
                Set<String> oldSet = new HashSet<>(oldStoryIds);
                for (String storyId : newStoryIds) {
                    if (!oldSet.contains(storyId)) {
                        storyRepository.findById(storyId).ifPresent(story -> {
                            if (story.getUserId().equals(currentUserId) && !story.isArchived()) {
                                story.setArchived(true);
                                story.setExpireAt(null);
                                story.setHighlightCategory(highlight.getTitle());
                                storyRepository.save(story);
                                log.info("Archived story {} for highlight '{}'", storyId, highlight.getTitle());
                            }
                        });
                    }
                }
                
                // Find removed stories and unarchive if no longer in any other highlight
                Set<String> newSet = new HashSet<>(newStoryIds);
                List<String> removedIds = oldStoryIds.stream()
                        .filter(id -> !newSet.contains(id))
                        .collect(Collectors.toList());
                
                if (!removedIds.isEmpty()) {
                    List<StoryHighlight> otherHighlights = storyHighlightRepository.findByUserId(currentUserId)
                            .stream()
                            .filter(h -> !h.getId().equals(highlightId))
                            .collect(Collectors.toList());
                    Set<String> stillReferencedIds = otherHighlights.stream()
                            .filter(h -> h.getStoryIds() != null)
                            .flatMap(h -> h.getStoryIds().stream())
                            .collect(Collectors.toSet());
                    
                    for (String removedId : removedIds) {
                        if (!stillReferencedIds.contains(removedId)) {
                            storyRepository.findById(removedId).ifPresent(story -> {
                                if (story.getUserId().equals(currentUserId) && story.isArchived()) {
                                    story.setArchived(false);
                                    story.setHighlightCategory(null);
                                    if (story.getExpireAt() == null && story.getCreatedAt() != null) {
                                        story.setExpireAt(story.getCreatedAt().plusSeconds(86400));
                                    }
                                    storyRepository.save(story);
                                    log.info("Unarchived story {} after removal from highlight '{}'", removedId, highlight.getTitle());
                                }
                            });
                        }
                    }
                }
                
                highlight.setStoryIds(newStoryIds);
            }
            
            highlight.setUpdatedAt(Instant.now());
            StoryHighlight savedHighlight = storyHighlightRepository.save(highlight);
            log.info("Updated highlight '{}' ({}) for user {}", savedHighlight.getTitle(), highlightId, currentUserId);
            
            return ResponseEntity.ok(mapToHighlightResponse(savedHighlight));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error updating highlight: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/stories/highlights/{highlightId}/stories - Add stories to an existing highlight
     * Body: { "storyIds": ["id1", "id2", ...] }
     * Archives added stories automatically.
     */
    @PostMapping("/highlights/{highlightId}/stories")
    public ResponseEntity<StoryHighlightResponse> addStoriesToHighlight(
            @PathVariable String highlightId,
            @RequestBody Map<String, Object> request) {
        try {
            String currentUserId = getCurrentUserId();
            
            Optional<StoryHighlight> highlightOpt = storyHighlightRepository.findById(highlightId);
            if (highlightOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            StoryHighlight highlight = highlightOpt.get();
            if (!highlight.getUserId().equals(currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            @SuppressWarnings("unchecked")
            List<String> storyIdsToAdd = (List<String>) request.get("storyIds");
            if (storyIdsToAdd == null || storyIdsToAdd.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            List<String> currentStoryIds = highlight.getStoryIds() != null
                    ? new ArrayList<>(highlight.getStoryIds())
                    : new ArrayList<>();
            Set<String> existingSet = new HashSet<>(currentStoryIds);
            
            int addedCount = 0;
            for (String storyId : storyIdsToAdd) {
                if (existingSet.contains(storyId)) continue; // skip duplicates
                
                Optional<Story> storyOpt = storyRepository.findById(storyId);
                if (storyOpt.isEmpty()) continue;
                
                Story story = storyOpt.get();
                if (!story.getUserId().equals(currentUserId)) continue;
                
                // Archive the story
                if (!story.isArchived()) {
                    story.setArchived(true);
                    story.setExpireAt(null);
                    story.setHighlightCategory(highlight.getTitle());
                    storyRepository.save(story);
                }
                
                currentStoryIds.add(storyId);
                addedCount++;
            }
            
            if (addedCount == 0) {
                return ResponseEntity.ok(mapToHighlightResponse(highlight)); // nothing to add
            }
            
            highlight.setStoryIds(currentStoryIds);
            highlight.setUpdatedAt(Instant.now());
            highlight = storyHighlightRepository.save(highlight);
            log.info("Added {} stories to highlight '{}' for user {}", addedCount, highlight.getTitle(), currentUserId);
            
            return ResponseEntity.ok(mapToHighlightResponse(highlight));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error adding stories to highlight: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * DELETE /api/stories/highlights/{highlightId}/stories - Remove stories from a highlight
     * Query params: storyIds=id1,id2,id3
     * Unarchives removed stories if they are no longer in any other highlight.
     */
    @DeleteMapping("/highlights/{highlightId}/stories")
    public ResponseEntity<StoryHighlightResponse> removeStoriesFromHighlight(
            @PathVariable String highlightId,
            @RequestParam List<String> storyIds) {
        try {
            String currentUserId = getCurrentUserId();
            
            Optional<StoryHighlight> highlightOpt = storyHighlightRepository.findById(highlightId);
            if (highlightOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            StoryHighlight highlight = highlightOpt.get();
            if (!highlight.getUserId().equals(currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            if (storyIds == null || storyIds.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            List<String> currentStoryIds = highlight.getStoryIds() != null
                    ? new ArrayList<>(highlight.getStoryIds())
                    : new ArrayList<>();
            Set<String> toRemove = new HashSet<>(storyIds);
            
            // Remove stories from highlight list
            List<String> removed = currentStoryIds.stream()
                    .filter(toRemove::contains)
                    .collect(Collectors.toList());
            currentStoryIds.removeAll(toRemove);
            
            // Unarchive removed stories if they're not in any other highlight
            if (!removed.isEmpty()) {
                List<StoryHighlight> otherHighlights = storyHighlightRepository.findByUserId(currentUserId)
                        .stream()
                        .filter(h -> !h.getId().equals(highlightId))
                        .collect(Collectors.toList());
                Set<String> stillReferencedIds = otherHighlights.stream()
                        .filter(h -> h.getStoryIds() != null)
                        .flatMap(h -> h.getStoryIds().stream())
                        .collect(Collectors.toSet());
                // Also include the stories that remain in THIS highlight
                stillReferencedIds.addAll(currentStoryIds);
                
                for (String removedId : removed) {
                    if (!stillReferencedIds.contains(removedId)) {
                        storyRepository.findById(removedId).ifPresent(story -> {
                            if (story.getUserId().equals(currentUserId) && story.isArchived()) {
                                story.setArchived(false);
                                story.setHighlightCategory(null);
                                if (story.getExpireAt() == null && story.getCreatedAt() != null) {
                                    story.setExpireAt(story.getCreatedAt().plusSeconds(86400));
                                }
                                storyRepository.save(story);
                                log.info("Unarchived story {} after removal from highlight", removedId);
                            }
                        });
                    }
                }
            }
            
            highlight.setStoryIds(currentStoryIds);
            highlight.setUpdatedAt(Instant.now());
            highlight = storyHighlightRepository.save(highlight);
            log.info("Removed {} stories from highlight '{}' for user {}", removed.size(), highlight.getTitle(), currentUserId);
            
            return ResponseEntity.ok(mapToHighlightResponse(highlight));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error removing stories from highlight: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/stories/user/{userId}/all - Get ALL stories for a user (including archived/expired)
     * Used by highlight selection modal to show available stories
     */
    @GetMapping("/user/{userId}/all")
    public ResponseEntity<List<StoryResponse>> getAllUserStories(@PathVariable String userId) {
        try {
            String currentUserId = getCurrentUserId();
            
            // Only owner can see all their stories
            if (!userId.equals(currentUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            List<Story> stories = storyRepository.findByUserIdAndStatusOrderByCreatedAtDesc(
                    userId, StatusType.ACTIVE
            );
            
            List<StoryResponse> responses = stories.stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(responses);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Error fetching all user stories: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Map StoryHighlight entity to response DTO with populated stories
     */
    private StoryHighlightResponse mapToHighlightResponse(StoryHighlight highlight) {
        List<StoryResponse> storyResponses = new ArrayList<>();
        if (highlight.getStoryIds() != null) {
            for (String storyId : highlight.getStoryIds()) {
                Optional<Story> storyOpt = storyRepository.findById(storyId);
                storyOpt.ifPresent(story -> storyResponses.add(mapToResponse(story)));
            }
        }
        
        return StoryHighlightResponse.builder()
                .id(highlight.getId())
                .userId(highlight.getUserId())
                .title(highlight.getTitle())
                .coverImageUrl(highlight.getCoverImageUrl())
                .stories(storyResponses)
                .displayOrder(highlight.getDisplayOrder())
                .viewCount(highlight.getViewCount())
                .createdAt(highlight.getCreatedAt())
                .updatedAt(highlight.getUpdatedAt())
                .build();
    }

    /**
     * Map Story entity to response DTO
     */
    private StoryResponse mapToResponse(Story story) {
        StoryResponse.UserSummary userSummary = null;
        try {
            if (story.getUserId() != null) {
                Long uid = Long.parseLong(story.getUserId());
                Optional<User> uOpt = userRepository.findById(uid);
                if (uOpt.isPresent()) {
                    User u = uOpt.get();
                    userSummary = StoryResponse.UserSummary.builder()
                            .username(u.getUsername() != null ? u.getUsername() : u.getName())
                            .avatarUrl(u.getAvatarUrl())
                            .build();
                }
            }
        } catch (Exception e) {
            log.warn("Failed to map user info for story user ID: {}", story.getUserId(), e);
        }

        // Calculate actual view count from StoryView records, excluding story owner
        int actualViewCount = 0;
        try {
            List<StoryView> views = storyViewRepository.findByStoryIdOrderByCreatedAtDesc(story.getId());
            Set<String> uniqueNonOwnerViewers = new HashSet<>();
            for (StoryView v : views) {
                if (!v.getViewerId().equals(story.getUserId())) {
                    uniqueNonOwnerViewers.add(v.getViewerId());
                }
            }
            actualViewCount = uniqueNonOwnerViewers.size();
        } catch (Exception e) {
            // Fallback to stats counter if query fails
            actualViewCount = (int) (story.getStats() != null ? story.getStats().getViewCount() : 0);
            log.warn("Failed to compute actual viewCount for story {}, using stats fallback: {}", story.getId(), actualViewCount);
        }

        return StoryResponse.builder()
                .id(story.getId())
                .userId(story.getUserId())
                .user(userSummary)
                .content(story.getContent())
                .media(story.getMedia())
                .text_layers(story.getText_layers())
                .music_stickers(story.getMusic_stickers())
                .music(story.getMusic())
                .duration_ms(story.getDuration_ms())
                .privacy(story.getPrivacy())
                .allowReplies(story.isAllowReplies())
                .allowReactions(story.isAllowReactions())
                .allowSharing(story.isAllowSharing())
                .viewCount(actualViewCount)
                .reactCount((int) (story.getStats() != null ? story.getStats().getReactCount() : 0))
                .replyCount((int) story.getReplyCount())
                .shareCount((int) (story.getStats() != null ? story.getStats().getShareCount() : 0))
                .isArchived(story.isArchived())
                .highlightCategory(story.getHighlightCategory())
                .createdAt(story.getCreatedAt())
                .expireAt(story.getExpireAt())
                .build();
    }

    /**
     * Parse music_stickers JSON from request parameter
     */
    private List<iuh.fit.edu.backend.modules.story.entity.MusicSticker> parseMusicStickers(String music_stickers_json) {
        List<iuh.fit.edu.backend.modules.story.entity.MusicSticker> stickers = new ArrayList<>();
        
        if (music_stickers_json == null || music_stickers_json.isBlank()) {
            return stickers;
        }
        
        try {
            Gson gson = new Gson();
            JsonArray stickersArray = gson.fromJson(music_stickers_json, JsonArray.class);
            
            for (int i = 0; i < stickersArray.size(); i++) {
                JsonObject stickerObj = stickersArray.get(i).getAsJsonObject();
                
                // Parse meta object
                JsonObject metaObj = stickerObj.has("meta") ? stickerObj.getAsJsonObject("meta") : new JsonObject();
                
                iuh.fit.edu.backend.modules.story.entity.MusicSticker.MusicMetadata meta = 
                    iuh.fit.edu.backend.modules.story.entity.MusicSticker.MusicMetadata.builder()
                        .track_id(metaObj.has("track_id") ? metaObj.get("track_id").getAsString() : "")
                        .title(metaObj.has("title") ? metaObj.get("title").getAsString() : "")
                        .artist(metaObj.has("artist") ? metaObj.get("artist").getAsString() : "")
                        .cover_url(metaObj.has("cover_url") ? metaObj.get("cover_url").getAsString() : null)
                        .start_sec(metaObj.has("start_sec") ? metaObj.get("start_sec").getAsInt() : null)
                        .end_sec(metaObj.has("end_sec") ? metaObj.get("end_sec").getAsInt() : null)
                        .build();
                
                iuh.fit.edu.backend.modules.story.entity.MusicSticker sticker = 
                    iuh.fit.edu.backend.modules.story.entity.MusicSticker.builder()
                        .id(stickerObj.has("id") ? stickerObj.get("id").getAsString() : UUID.randomUUID().toString())
                        .x_pct(stickerObj.has("x_pct") ? stickerObj.get("x_pct").getAsFloat() : 0.5f)
                        .y_pct(stickerObj.has("y_pct") ? stickerObj.get("y_pct").getAsFloat() : 0.5f)
                        .width_pct(stickerObj.has("width_pct") ? stickerObj.get("width_pct").getAsFloat() : null)
                        .height_pct(stickerObj.has("height_pct") ? stickerObj.get("height_pct").getAsFloat() : null)
                        .rotation_deg(stickerObj.has("rotation_deg") ? stickerObj.get("rotation_deg").getAsFloat() : 0f)
                        .meta(meta)
                        .style(stickerObj.has("style") ? stickerObj.get("style").getAsString() : "rectangle")
                        .z_index(stickerObj.has("z_index") ? stickerObj.get("z_index").getAsInt() : i)
                        .build();
                
                stickers.add(sticker);
            }
            
            log.info("Parsed {} music stickers from request", stickers.size());
        } catch (Exception e) {
            log.warn("Failed to parse music_stickers JSON: {}", e.getMessage());
        }
        
        return stickers;
    }
}

