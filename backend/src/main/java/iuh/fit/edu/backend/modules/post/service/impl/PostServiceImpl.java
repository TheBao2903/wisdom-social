/*
 * @ (#) PostServiceImpl.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.common.constant.UploadModule;
import iuh.fit.edu.backend.modules.media.entity.Media;
import iuh.fit.edu.backend.modules.media.entity.MediaMetadata;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.entity.Stats;
import iuh.fit.edu.backend.modules.post.entity.Location;
import iuh.fit.edu.backend.modules.post.dto.request.CreatePostRequest;
import iuh.fit.edu.backend.modules.post.dto.request.MediaUploadMetadataRequest;
import iuh.fit.edu.backend.modules.post.event.payload.PostEvent;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.post.repository.CommentRepository;
import iuh.fit.edu.backend.modules.post.repository.PostRepository;
import iuh.fit.edu.backend.modules.post.repository.ReactionRepository;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import iuh.fit.edu.backend.modules.post.service.PostService;
import iuh.fit.edu.backend.modules.post.service.HashtagTrendingService;
import iuh.fit.edu.backend.modules.user.service.FriendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/*
 * @description: Post service implementation
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PostServiceImpl implements PostService {
    private final ApplicationEventPublisher eventPublisher;
    
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;
    private final ReactionRepository reactionRepository;
    private final CommentRepository commentRepository;
    private final FriendService friendService;
    private final HashtagTrendingService hashtagTrendingService;
    
    @Override
    @Transactional
    public Post createPost(CreatePostRequest request, List<String> imageUrls, Long authorId) {
        log.info("Creating post for user: {}", authorId);
        log.info("Image URLs received: {}", imageUrls);
        
        // First, create and save post to get ID
        List<Media> mediaList = new ArrayList<>();
        
        // Extract hashtags from content
        List<String> hashtags = extractHashtags(request.getContent());
        
        // Extract mentions from content
        List<String> mentions = extractMentions(request.getContent());
        
        // Convert tagged usernames to IDs
        List<String> taggedUserIds = convertUsernamesToIds(request.getTaggedUsernames());
        
        // Parse location
        Location location = null;
        if (request.getLocation() != null && !request.getLocation().isEmpty()) {
            location = Location.builder()
                    .name(request.getLocation())
                    .build();
        }
        
        // Convert specific viewer usernames to IDs (for SPECIFIC privacy)
        List<String> specificViewerUserIds = convertUsernamesToIds(request.getSpecificViewerUsernames());
        
        // Convert excluded usernames to IDs (for EXCEPT privacy)
        List<String> excludedUserIds = convertUsernamesToIds(request.getExcludedUsernames());
        
        // Create post
        Instant now = Instant.now();
        Post post = Post.builder()
                .authorId(authorId.toString())
                .content(request.getContent())
                .privacy(request.getPrivacy())
                .specificViewerUserIds(specificViewerUserIds)
                .excludedUserIds(excludedUserIds)
                .media(mediaList)
                .location(location)
                .taggedUserIds(taggedUserIds)
                .hashtags(hashtags)
                .mentions(mentions)
                .allowComments(request.getAllowComments() != null ? request.getAllowComments() : true)
                .allowShares(request.getAllowShares() != null ? request.getAllowShares() : true)
                .music(request.getMusic())
                .stats(Stats.builder()
                        .reactCount(0)
                        .commentCount(0)
                        .shareCount(0)
                        .viewCount(0)
                        .build())
                .status(StatusType.ACTIVE)
                .isEdited(false)
                .createdAt(now)
                .updatedAt(now)
                .lastActivityAt(now)
                .build();
        
        // Save post to MongoDB to get ID
        Post savedPost = postRepository.save(post);
        log.info("Post saved to MongoDB successfully: {}", savedPost.getId());
        
        // Move images from temp to final location if provided and update post
        if (imageUrls != null && !imageUrls.isEmpty()) {
            log.info("Processing {} images to move from temp to final location", imageUrls.size());
            try {
                // Create Media objects for uploaded images
                for (int i = 0; i < imageUrls.size(); i++) {
                    String tempUrl = imageUrls.get(i);
                    log.info("Processing image {}: {}", i, tempUrl);
                    
                    try {
                        // Move from temp to final location using MongoDB ID (String)
                        String finalUrl = s3Service.moveUploadUrl("posts", savedPost.getId(), tempUrl);
                        log.info("Successfully moved image {} to final location: {}", i, finalUrl);
                        String canonicalKey = canonicalizePostMediaKeyForStorage(finalUrl, savedPost.getId(), null);
                        
                        Media media = buildMediaWithMetadata(i, canonicalKey, request, i);
                        mediaList.add(media);
                        log.info("Created media object for image {}", i);
                    } catch (Exception e) {
                        // If move fails, log warning but continue 
                        // File might already be in final location
                        String inferredType = resolveMediaTypeFromKey(tempUrl);
                        String sourceKey = buildPostMediaKeyFromUploadInput(tempUrl, authorId.toString(), inferredType);
                        String relocatedKey = sourceKey;
                        try {
                            relocatedKey = s3Service.relocatePostMediaKey(sourceKey, savedPost.getId(), inferredType);
                        } catch (Exception relocateEx) {
                            log.warn("Relocate failed for image {}: {}. Keep source key: {}", i, relocateEx.getMessage(), sourceKey);
                        }
                        String canonicalKey = canonicalizePostMediaKeyForStorage(relocatedKey, savedPost.getId(), inferredType);
                        log.warn("Failed to move image {}: {}. Using key: {}", i, e.getMessage(), canonicalKey);
                        
                        Media media = buildMediaWithMetadata(i, canonicalKey, request, i);
                        mediaList.add(media);
                    }
                }
                
                // Update post with media list
                if (!mediaList.isEmpty()) {
                    log.info("Saving post with {} media items", mediaList.size());
                    savedPost.setMedia(mediaList);
                    savedPost = postRepository.save(savedPost);
                    log.info("Post updated with media successfully");
                } else {
                    log.warn("No media items to save");
                }
            } catch (Exception e) {
                log.error("Error processing images: {}", e.getMessage());
                // Still return post even if image processing fails
                // Post has already been created successfully
            }
        } else {
            log.info("No image URLs provided");
        }
        
        // Update hashtag trending stats
        if (savedPost.getHashtags() != null && !savedPost.getHashtags().isEmpty()) {
            try {
                hashtagTrendingService.updateHashtagOnPostCreated(savedPost.getId(), savedPost.getAuthorId(), savedPost.getHashtags());
            } catch (Exception e) {
                log.error("Failed to update hashtag trending for post {}: {}", savedPost.getId(), e.getMessage());
            }
        }

        // Broadcast CREATE event - Post-commit for stability
        final Post finalPost = savedPost;
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    eventPublisher.publishEvent(PostEvent.builder()
                            .action("CREATE")
                            .post(finalPost)
                            .postId(finalPost.getId())
                            .authorId(finalPost.getAuthorId())
                            .build());
                }
            });
        } else {
            eventPublisher.publishEvent(PostEvent.builder()
                    .action("CREATE")
                    .post(finalPost)
                    .postId(finalPost.getId())
                    .authorId(finalPost.getAuthorId())
                    .build());
        }
    
        return savedPost;
    }
    
    private List<String> convertUsernamesToIds(List<String> usernames) {
        if (usernames == null || usernames.isEmpty()) {
            return new ArrayList<>();
        }
        return usernames.stream()
                .map(username -> userRepository.findByUsername(username)
                        .map(user -> user.getId().toString())
                        .orElse(null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
    
    private List<String> extractHashtags(String content) {
        if (content == null) return new ArrayList<>();
        
        List<String> hashtags = new ArrayList<>();
        Pattern pattern = Pattern.compile("#[\\w]+");
        Matcher matcher = pattern.matcher(content);
        
        while (matcher.find()) {
            String hashtag = matcher.group().substring(1); // Remove # symbol
            hashtags.add(hashtag);
        }
        
        return hashtags;
    }
    
    private List<String> extractMentions(String content) {
        if (content == null) return new ArrayList<>();
        
        List<String> mentions = new ArrayList<>();
        Pattern pattern = Pattern.compile("@[\\w]+");
        Matcher matcher = pattern.matcher(content);
        
        while (matcher.find()) {
            String username = matcher.group().substring(1); // Remove @ symbol
            userRepository.findByUsername(username).ifPresent(user -> 
                mentions.add(user.getId().toString())
            );
        }
        
        return mentions;
    }

    @Override
    public Page<Post> getPostsByUserId(Long userId, Long currentUserId, int page, int size) {
        log.info("Getting posts for user {} viewed by {}, page={}, size={}", userId, currentUserId, page, size);

        // Fetch friend IDs of the viewer to apply privacy rules
        List<String> friendIds = new ArrayList<>();
        if (currentUserId != null) {
            friendIds = friendService.getAcceptedFriendIds(currentUserId).stream()
                    .map(Object::toString)
                    .collect(Collectors.toList());
        }

        String viewerId = currentUserId != null ? currentUserId.toString() : "";
        List<Post> posts = postRepository.findProfilePosts(userId.toString(), viewerId, friendIds, page, size);
        long total = postRepository.countProfilePosts(userId.toString(), viewerId, friendIds);

        posts.forEach(this::sanitizeMediaKeys);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return new PageImpl<>(posts, pageable, total);
    }

    @Override
    public long countPostsByUserId(Long userId, Long currentUserId) {
        log.info("Counting posts for user {} viewed by {}", userId, currentUserId);
        
        List<String> friendIds = new ArrayList<>();
        if (currentUserId != null) {
            friendIds = friendService.getAcceptedFriendIds(currentUserId).stream()
                    .map(Object::toString)
                    .collect(Collectors.toList());
        }

        String viewerId = currentUserId != null ? currentUserId.toString() : "";
        return postRepository.countProfilePosts(userId.toString(), viewerId, friendIds);
    }

    @Override
    public Post getPostById(String postId) {
        log.info("Getting post by ID: {}", postId);
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found with id: " + postId));
        sanitizeMediaKeys(post);
        log.info("Post found. Media items: {}", post.getMedia() != null ? post.getMedia().size() : 0);
        if (post.getMedia() != null) {
            post.getMedia().forEach(media -> log.info("Media: {}", media.getUrl()));
        }
        return post;
    }

    @Override
    @Transactional
    public void deletePost(String postId, Long userId) {
        log.info("Deleting post {} by user {}", postId, userId);
        
        // Get post to check authorization
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found with id: " + postId));
        
        // Check if user is the author
        if (!post.getAuthorId().equals(userId.toString())) {
            throw new RuntimeException("Unauthorized: You can only delete your own posts");
        }

        if (post.getMedia() != null && !post.getMedia().isEmpty()) {
            for (Media media : post.getMedia()) {
                if (media == null || media.getUrl() == null || media.getUrl().isBlank()) {
                    continue;
                }
                try {
                    String canonicalKey = normalizePostMediaKey(media.getUrl(), postId, media.getType());
                    log.info("Deleting post media from S3: raw={} -> key={}", media.getUrl(), canonicalKey);
                    s3Service.deleteByKey(UploadModule.POST, canonicalKey);
                } catch (Exception e) {
                    log.warn("Failed to delete S3 media {} for post {}: {}", media.getUrl(), postId, e.getMessage());
                }
            }
        }
        
        // Update hashtag trending stats
        if (post.getHashtags() != null && !post.getHashtags().isEmpty()) {
            try {
                hashtagTrendingService.updateHashtagOnPostDeleted(postId, post.getHashtags());
            } catch (Exception e) {
                log.error("Failed to update hashtag trending on post delete {}: {}", postId, e.getMessage());
            }
        }

        // Delete the post
        postRepository.delete(post);
        log.info("Post {} deleted successfully", postId);

        // Broadcast DELETE event - Post-commit
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    eventPublisher.publishEvent(PostEvent.builder()
                            .action("DELETE")
                            .postId(postId)
                            .authorId(post.getAuthorId())
                            .build());
                }
            });
        } else {
            eventPublisher.publishEvent(PostEvent.builder()
                    .action("DELETE")
                    .postId(postId)
                    .authorId(post.getAuthorId())
                    .build());
        }
    }

    @Override
    @Transactional
    public Post updatePost(String postId, CreatePostRequest request, List<String> newImageUrls, Long userId) {
        log.info("🔄 Updating post {} by user {}", postId, userId);
        
        // Get post to check authorization
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found with id: " + postId));
        
        // Debug logging
        log.info("Post authorId: {}, User ID: {}, Comparison: {}", 
                post.getAuthorId(), userId.toString(), post.getAuthorId().equals(userId.toString()));
        
        // Check if user is the author
        if (!post.getAuthorId().equals(userId.toString())) {
            throw new RuntimeException("Unauthorized: You can only edit your own posts");
        }
        
        // Capture old hashtags for trending updates
        List<String> oldHashtags = post.getHashtags() != null ? new ArrayList<>(post.getHashtags()) : new ArrayList<>();

        // Update post fields only if provided (not null)
        if (request.getContent() != null) {
            post.setContent(request.getContent());
            // Extract hashtags and mentions only when content changes
            post.setHashtags(extractHashtags(request.getContent()));
            post.setMentions(extractMentions(request.getContent()));
        }
        if (request.getPrivacy() != null) {
            post.setPrivacy(request.getPrivacy());
        }
        
        // Update location if provided
        if (request.getLocation() != null) {
            if (request.getLocation().isEmpty()) {
                post.setLocation(null);
            } else {
                Location location = Location.builder()
                        .name(request.getLocation())
                        .build();
                post.setLocation(location);
            }
        }
        
        // Update tagged users - convert usernames to IDs if provided
        if (request.getTaggedUsernames() != null) {
            post.setTaggedUserIds(convertUsernamesToIds(request.getTaggedUsernames()));
        } else if (request.getTaggedUserIds() != null) {
            post.setTaggedUserIds(request.getTaggedUserIds());
        }
        
        // Update specific viewer usernames to IDs (for SPECIFIC privacy)
        if (request.getSpecificViewerUsernames() != null) {
            post.setSpecificViewerUserIds(convertUsernamesToIds(request.getSpecificViewerUsernames()));
        }
        
        // Update excluded usernames to IDs (for EXCEPT privacy)
        if (request.getExcludedUsernames() != null) {
            post.setExcludedUserIds(convertUsernamesToIds(request.getExcludedUsernames()));
        }
        
        // ====================================================================
        // HANDLE MEDIA UPDATES & NULL CHECK (FIX FOR PARTIAL PRIVACY UPDATES)
        // ====================================================================
        boolean hasMediaUpdates = request.getExistingMediaUrls() != null || (newImageUrls != null && !newImageUrls.isEmpty());
        if (hasMediaUpdates) {
            List<String> oldMediaUrls = post.getMedia() != null
                    ? post.getMedia().stream()
                        .map(Media::getUrl)
                        .collect(Collectors.toList())
                    : new ArrayList<>();
            
            // Determine which URLs to keep
            List<String> keepUrls = request.getExistingMediaUrls() != null ? request.getExistingMediaUrls() : oldMediaUrls;
            log.info("📌 existingMediaUrls provided with {} items → using this list", keepUrls.size());
            
            // Find and DELETE removed images from S3
            Set<String> keepNormalized = new HashSet<>();
            for (String keepUrl : keepUrls) {
                String normalizedKeep = normalizePostMediaKey(keepUrl, postId, null);
                if (normalizedKeep != null && !normalizedKeep.isBlank()) {
                    keepNormalized.add(normalizedKeep);
                }
            }

            List<String> removedUrls = oldMediaUrls.stream()
                    .filter(url -> {
                        String normalizedOld = normalizePostMediaKey(url, postId, null);
                        if (normalizedOld == null || normalizedOld.isBlank()) {
                            return !keepUrls.contains(url);
                        }
                        return !keepNormalized.contains(normalizedOld);
                    })
                    .collect(Collectors.toList());
            
            if (!removedUrls.isEmpty()) {
                log.warn("🗑️ Deleting {} removed images from S3...", removedUrls.size());
                for (String removedUrl : removedUrls) {
                    try {
                        String normalizedKey = normalizePostMediaKey(removedUrl, postId, null);
                        log.info("   Deleting from S3: {} -> normalized: {}", removedUrl, normalizedKey);
                        s3Service.deleteByKey(UploadModule.POST, normalizedKey);
                        log.info("   ✅ Successfully deleted: {}", removedUrl);
                    } catch (Exception e) {
                        log.error("   ❌ Failed to delete {}: {}", removedUrl, e.getMessage(), e);
                    }
                }
            } else {
                log.info("ℹ️ No images to delete");
            }
            
            // REBUILD MEDIA LIST CLEANLY
            List<Media> updatedMediaList = new ArrayList<>();
            
            // Step 1: Add existing images in original order from frontend, preserving metadata if possible
            log.info("📝 Step 1: Adding {} kept images (preserving order)...", keepUrls.size());
            for (int i = 0; i < keepUrls.size(); i++) {
                String url = keepUrls.get(i);
                String canonicalUrl = canonicalizePostMediaKeyForStorage(url, postId, null);
                
                // Try to find the original Media object to preserve all of its metadata
                Media originalMedia = null;
                if (post.getMedia() != null) {
                    String normCanonical = normalizePostMediaKey(canonicalUrl, postId, null);
                    for (Media m : post.getMedia()) {
                        String normM = normalizePostMediaKey(m.getUrl(), postId, null);
                        if (normCanonical != null && normCanonical.equals(normM)) {
                            originalMedia = m;
                            break;
                        }
                    }
                }
                
                Media media;
                if (originalMedia != null) {
                    media = Media.builder()
                        .order(i)
                        .url(originalMedia.getUrl())
                        .type(originalMedia.getType())
                        .duration(originalMedia.getDuration())
                        .width(originalMedia.getWidth())
                        .height(originalMedia.getHeight())
                        .metadata(originalMedia.getMetadata())
                        .build();
                } else {
                    media = Media.builder()
                        .order(i)
                        .url(canonicalUrl)
                        .type(resolveMediaTypeFromKey(canonicalUrl))
                        .build();
                }
                updatedMediaList.add(media);
                log.info("   [{}] Added existing image: {}", i, canonicalUrl);
            }
            
            // Step 2: ADD NEW IMAGES (MOVE FROM TEMP → FINAL)
            int startIndex = updatedMediaList.size();
            if (newImageUrls != null && !newImageUrls.isEmpty()) {
                log.info("📝 Step 2: Moving {} new images from TEMP to FINAL...", newImageUrls.size());
                try {
                    for (int i = 0; i < newImageUrls.size(); i++) {
                        String tempKey = newImageUrls.get(i);
                        log.info("   [{}] Processing temp key: {}", i, tempKey);

                        String finalKey;
                        try {
                            finalKey = s3Service.moveUploadUrl("posts", postId, tempKey);
                        } catch (Exception moveEx) {
                            String inferredType = resolveMediaTypeFromKey(tempKey);
                            String sourceKey = buildPostMediaKeyFromUploadInput(tempKey, post.getAuthorId(), inferredType);
                            try {
                                finalKey = s3Service.relocatePostMediaKey(sourceKey, postId, inferredType);
                            } catch (Exception relocateEx) {
                                finalKey = sourceKey;
                                log.warn("   [{}] Relocate failed ({}), keep source key: {}", i, relocateEx.getMessage(), sourceKey);
                            }
                            log.warn("   [{}] Move failed ({}), fallback to key: {}", i, moveEx.getMessage(), finalKey);
                        }
                        String canonicalFinalKey = canonicalizePostMediaKeyForStorage(finalKey, postId, null);
                        
                        Media media = buildMediaWithMetadata(startIndex + i, canonicalFinalKey, request, i);
                        updatedMediaList.add(media);
                        log.info("   [{}] ✅ Final media key: {} -> canonical: {}", startIndex + i, finalKey, canonicalFinalKey);
                    }
                } catch (Exception e) {
                    log.error("❌ Error moving images: {}", e.getMessage(), e);
                    throw new RuntimeException("Failed to move images from temp to final: " + e.getMessage(), e);
                }
            }
            
            post.setMedia(updatedMediaList);
        }
        
        // Update interaction settings
        if (request.getAllowComments() != null) {
            post.setAllowComments(request.getAllowComments());
        }
        if (request.getAllowShares() != null) {
            post.setAllowShares(request.getAllowShares());
        }
        
        if (request.getMusic() != null) {
            post.setMusic(request.getMusic());
        }
        
        post.setUpdatedAt(Instant.now());
        post.setLastActivityAt(Instant.now());
        
        Post updated = postRepository.save(post);
        log.info("✅ Post {} updated successfully with {} media items", postId, updated.getMedia().size());
        
        // Update hashtag trending stats
        try {
            hashtagTrendingService.updateHashtagOnPostUpdated(updated.getId(), updated.getAuthorId(), oldHashtags, updated.getHashtags());
        } catch (Exception e) {
            log.error("Failed to update hashtag trending on post update {}: {}", updated.getId(), e.getMessage());
        }

        // Broadcast UPDATE event - Post-commit
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    eventPublisher.publishEvent(PostEvent.builder()
                            .action("UPDATE")
                            .post(updated)
                            .postId(updated.getId())
                            .authorId(updated.getAuthorId())
                            .lastActivityAt(updated.getLastActivityAt())
                            .build());
                }
            });
        } else {
            eventPublisher.publishEvent(PostEvent.builder()
                    .action("UPDATE")
                    .post(updated)
                    .postId(updated.getId())
                    .authorId(updated.getAuthorId())
                    .lastActivityAt(updated.getLastActivityAt())
                    .build());
        }

        return updated;
    }

    @Override
    public List<Post> getPostsByTaggedUserId(String userId) {
        log.info("Getting posts where user {} is tagged", userId);
        List<Post> posts = postRepository.findByTaggedUserIdsContaining(userId);
        posts.forEach(this::sanitizeMediaKeys);
        return posts;
    }

    @Override
    @Transactional
    public void syncAllPostsStats() {
        log.info("Starting to sync stats for all posts");
        List<Post> allPosts = postRepository.findAll();
        
        for (Post post : allPosts) {
            try {
                // Count reactions for this post
                long reactCount = reactionRepository.findByTargetTypeAndTargetId(
                    TargetType.POST, 
                    post.getId()
                ).size();
                
                // Count top-level comments for this post (parentId == null)
                long commentCount = commentRepository.findByTargetTypeAndTargetIdOrderByCreatedAtDesc(
                    TargetType.POST, 
                    post.getId()
                ).stream()
                .filter(comment -> comment.getParentId() == null)
                .count();
                
                // Update stats
                if (post.getStats() == null) {
                    post.setStats(new Stats());
                }
                post.getStats().setReactCount(reactCount);
                post.getStats().setCommentCount(commentCount);
                
                postRepository.save(post);
                log.info("Updated stats for post {}: {} reactions, {} comments", 
                    post.getId(), reactCount, commentCount);
            } catch (Exception e) {
                log.error("Error syncing stats for post {}: {}", post.getId(), e.getMessage());
            }
        }
        
        log.info("Finished syncing stats for {} posts", allPosts.size());
    }

    private String extractS3Key(String input) {
        if (input == null) return null;
        String value = input.trim();
        if (value.isEmpty()) return value;

        int queryIndex = value.indexOf('?');
        if (queryIndex >= 0) {
            value = value.substring(0, queryIndex);
        }
        int fragmentIndex = value.indexOf('#');
        if (fragmentIndex >= 0) {
            value = value.substring(0, fragmentIndex);
        }

        int amazonIndex = value.indexOf("amazonaws.com/");
        if (amazonIndex >= 0) {
            value = value.substring(amazonIndex + "amazonaws.com/".length());
        }

        while (value.startsWith("/")) {
            value = value.substring(1);
        }

        int postsIndex = value.indexOf("posts/");
        if (postsIndex > 0) {
            value = value.substring(postsIndex);
        }

        return value;
    }

    private String normalizePostMediaKey(String input, String fallbackPostId, String mediaType) {
        String key = extractS3Key(input);
        if (key == null || key.isBlank()) return key;

        if (key.startsWith("images/posts/")) {
            String rest = key.substring("images/posts/".length());
            int slash = rest.indexOf('/');
            if (slash > 0 && slash < rest.length() - 1) {
                return "posts/" + rest.substring(0, slash) + "/images/" + rest.substring(slash + 1);
            }
        }
        if (key.startsWith("videos/posts/")) {
            String rest = key.substring("videos/posts/".length());
            int slash = rest.indexOf('/');
            if (slash > 0 && slash < rest.length() - 1) {
                return "posts/" + rest.substring(0, slash) + "/videos/" + rest.substring(slash + 1);
            }
        }
        if (key.startsWith("files/posts/")) {
            String rest = key.substring("files/posts/".length());
            int slash = rest.indexOf('/');
            if (slash > 0 && slash < rest.length() - 1) {
                return "posts/" + rest.substring(0, slash) + "/files/" + rest.substring(slash + 1);
            }
        }

        if (key.startsWith("posts/")) {
            String[] parts = key.split("/");
            if (parts.length >= 4) {
                return key;
            }

            if (parts.length == 3) {
                String subFolder = inferPostMediaSubFolder(parts[2], mediaType);
                return "posts/" + parts[1] + "/" + subFolder + "/" + parts[2];
            }
        }

        if (!key.contains("/") && fallbackPostId != null && !fallbackPostId.isBlank()) {
            String subFolder = inferPostMediaSubFolder(key, mediaType);
            return "posts/" + fallbackPostId + "/" + subFolder + "/" + key;
        }

        return key;
    }

    private String buildPostMediaKeyFromUploadInput(String uploadInput, String ownerId, String mediaType) {
        String extracted = extractS3Key(uploadInput);
        if (extracted == null || extracted.isBlank()) {
            return extracted;
        }

        if (extracted.startsWith("posts/") || extracted.startsWith("images/posts/") || extracted.startsWith("videos/posts/") || extracted.startsWith("files/posts/")) {
            return extracted;
        }

        String subFolder = inferPostMediaSubFolder(extracted, mediaType);
        return "posts/" + ownerId + "/" + subFolder + "/" + extracted;
    }

    private String inferPostMediaSubFolder(String filenameOrKey, String mediaType) {
        if (mediaType != null && !mediaType.isBlank()) {
            String t = mediaType.trim().toLowerCase();
            if (t.contains("video")) return "videos";
            if (t.contains("file")) return "files";
            return "images";
        }

        String lower = filenameOrKey == null ? "" : filenameOrKey.toLowerCase();
        if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".avi") || lower.endsWith(".mkv")) {
            return "videos";
        }
        return "images";
    }

    private String resolveMediaTypeFromKey(String key) {
        if (key == null) return "image";
        String lower = key.toLowerCase();
        if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".avi") || lower.endsWith(".mkv") || lower.contains("/videos/")) {
            return "video";
        }
        return "image";
    }

    private String canonicalizePostMediaKeyForStorage(String input, String fallbackPostId, String mediaType) {
        String normalized = normalizePostMediaKey(input, fallbackPostId, mediaType);
        if (normalized == null || normalized.isBlank()) return normalized;

        if (normalized.startsWith("posts/")) {
            String[] parts = normalized.split("/");
            if (parts.length >= 4) {
                String expectedFolder = inferPostMediaSubFolder(parts[parts.length - 1], mediaType);
                String currentFolder = parts[2];
                if (!expectedFolder.equals(currentFolder)) {
                    parts[2] = expectedFolder;
                    return String.join("/", parts);
                }
            }
        }

        return normalized;
    }

    private Media buildMediaWithMetadata(int order, String canonicalKey, CreatePostRequest request, int metadataIndex) {
        Media.MediaBuilder builder = Media.builder()
                .order(order)
                .url(canonicalKey)
                .type(resolveMediaTypeFromKey(canonicalKey));

        MediaUploadMetadataRequest metadataRequest = getMediaUploadMetadata(request, metadataIndex);
        if (metadataRequest == null) {
            return builder.build();
        }

        if (metadataRequest.getDuration() != null) {
            builder.duration(metadataRequest.getDuration());
        }
        if (metadataRequest.getWidth() != null) {
            builder.width(metadataRequest.getWidth());
        }
        if (metadataRequest.getHeight() != null) {
            builder.height(metadataRequest.getHeight());
        }

        MediaMetadata.MediaMetadataBuilder metadataBuilder = MediaMetadata.builder();
        boolean hasMetadata = false;

        if (metadataRequest.getFileSize() != null) {
            metadataBuilder.fileSize(metadataRequest.getFileSize());
            hasMetadata = true;
        }
        if (metadataRequest.getMimeType() != null && !metadataRequest.getMimeType().isBlank()) {
            metadataBuilder.mimeType(metadataRequest.getMimeType());
            hasMetadata = true;
        }
        if (metadataRequest.getOriginalFileName() != null && !metadataRequest.getOriginalFileName().isBlank()) {
            metadataBuilder.originalFileName(metadataRequest.getOriginalFileName());
            hasMetadata = true;
        }
        if (metadataRequest.getWidth() != null && metadataRequest.getHeight() != null) {
            metadataBuilder.resolution(metadataRequest.getWidth() + "x" + metadataRequest.getHeight());
            hasMetadata = true;
        }

        if (hasMetadata) {
            builder.metadata(metadataBuilder.build());
        }

        return builder.build();
    }

    private MediaUploadMetadataRequest getMediaUploadMetadata(CreatePostRequest request, int index) {
        if (request == null || request.getMediaMetadatas() == null || request.getMediaMetadatas().isEmpty()) {
            return null;
        }
        if (index < 0 || index >= request.getMediaMetadatas().size()) {
            return null;
        }
        return request.getMediaMetadatas().get(index);
    }

    private void sanitizeMediaKeys(Post post) {
        if (post == null || post.getMedia() == null || post.getMedia().isEmpty()) {
            return;
        }

        List<Media> mediaList = post.getMedia();
        for (Media media : mediaList) {
            if (media == null) {
                continue;
            }
            String canonical = canonicalizePostMediaKeyForStorage(media.getUrl(), post.getId(), media.getType());
            media.setUrl(canonical);
            media.setType(resolveMediaTypeFromKey(canonical));
        }
    }

    @Override
    public Page<Post> getPostsByHashtag(String hashtag, Long currentUserId, int page, int size) {
        log.info("Getting posts for hashtag {} viewed by {}, page={}, size={}", hashtag, currentUserId, page, size);

        List<String> friendIds = new ArrayList<>();
        if (currentUserId != null) {
            friendIds = friendService.getAcceptedFriendIds(currentUserId).stream()
                    .map(Object::toString)
                    .collect(Collectors.toList());
        }

        String viewerId = currentUserId != null ? currentUserId.toString() : "";
        List<Post> posts = postRepository.findPostsByHashtag(hashtag, viewerId, friendIds, page, size);
        long total = postRepository.countPostsByHashtag(hashtag, viewerId, friendIds);

        posts.forEach(this::sanitizeMediaKeys);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return new PageImpl<>(posts, pageable, total);
    }
}
