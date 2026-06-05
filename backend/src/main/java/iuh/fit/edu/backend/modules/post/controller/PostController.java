/*
 * @ (#) PostController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.common.constant.UploadModule;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.dto.request.CreatePostRequest;
import iuh.fit.edu.backend.modules.post.dto.response.FeedSliceResponse;
import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.common.dto.response.PresignedUrlResponse;
import iuh.fit.edu.backend.modules.post.service.FeedService;
import iuh.fit.edu.backend.modules.post.service.PostService;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/*
 * @description: Post management controller
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
@Slf4j
public class PostController {

    private final PostService postService;
    private final FeedService feedService;
    private final ObjectMapper objectMapper;
    private final UserService userService;
    private final S3Service s3Service;

// API này dùng để lấy danh sách bài viết (newsfeed) cho user hiện tại, bao gồm:
// Bài viết của chính user
// Bài viết của bạn bè (dựa trên quan hệ Friend)
// Áp dụng filter theo privacy và status
// Hỗ trợ pagination dạng cursor (không dùng page/skip)
    @GetMapping("/feed")
    public ResponseEntity<ApiResponse<FeedSliceResponse>> getFeed(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant lastActivityAt,
            @RequestParam(required = false) String lastPostId,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String prioritizePostId) {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập để xem feed", null));
            }
            
            FeedSliceResponse feed = feedService.getFeed(currentUser.getId(), lastActivityAt, lastPostId, size, prioritizePostId);
            if (feed.getPosts() != null) {
                feed.getPosts().forEach(this::attachAuthorSummary);
            }
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy feed thành công", feed));
        } catch (Exception e) {
            log.error("Error fetching feed", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy feed: " + e.getMessage(), null));
        }
    }

    /**
     * Get presigned upload URL for images
     * Uses UploadModule.POST for all post media uploads
     * @param extension File extension (jpg, png, mp4, etc.)
     * @param originalFilename Original filename for validation
     * @param contentType MIME type (image/jpeg, video/mp4, etc.)
     * @return Presigned URL and S3 object key
     */
    @GetMapping("/upload-url")
    public ResponseEntity<ApiResponse<PresignedUrlResponse>> getPresignedUploadUrl(
            @RequestParam String extension,
            @RequestParam(required = false) String originalFilename,
            @RequestParam(required = false) String contentType) {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập", null));
            }

            // Determine content type based on extension if not provided
            if (contentType == null || contentType.isBlank()) {
                contentType = s3Service.getContentType(extension);
            }

            String filename = originalFilename != null ? originalFilename : "post." + extension;
            
            PresignedUrlResponse response = s3Service.generatePresignedUrl(
                    UploadModule.POST,
                    String.valueOf(currentUser.getId()),
                    s3Service.resolveMediaType(extension),
                    filename,
                    contentType
            );
            
            log.info("Generated presigned URL for post upload: {}", response.getObjectKey());
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy link upload thành công", response));
        } catch (IllegalArgumentException e) {
            log.error("Invalid file: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage(), null));
        } catch (Exception e) {
            log.error("Error getting presigned URL", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi: " + e.getMessage(), null));
        }
    }

    /**
     * Create a new post with images (presigned URLs)
     * @param postDataJson JSON string of CreatePostRequest
     * @param imageUrls List of S3 image URLs from presigned upload
     * @return Created post
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Post>> createPost(
            @RequestParam("postData") String postDataJson,
            @RequestParam(value = "imageUrls", required = false) List<String> imageUrls) {
        
        try {
            // Get current user
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập để tạo post", null));
            }
            
            Long authorId = currentUser.getId();
            log.info("Creating post for user: {}", authorId);
            log.info("Post data: {}", postDataJson);
            log.info("Image URLs received: {} items", imageUrls == null ? "null" : imageUrls.size());
            if (imageUrls != null && !imageUrls.isEmpty()) {
                for (int i = 0; i < imageUrls.size(); i++) {
                    log.info("  Image {}: {}", i, imageUrls.get(i));
                }
            }
            
            // Parse JSON to CreatePostRequest
            CreatePostRequest request = objectMapper.readValue(postDataJson, CreatePostRequest.class);
            
            // Create post with presigned image URLs
            Post post = postService.createPost(request, imageUrls, authorId);
            
            return ResponseEntity.ok(ApiResponse.success(200, "Tạo post thành công", post));
        } catch (Exception e) {
            log.error("Error creating post", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi tạo post: " + e.getMessage(), null));
        }
    }

    /**
     * Get posts by user ID with pagination
     * @param userId User ID
     * @param page 0-based page index
     * @param size page size
     * @return Page of posts with metadata
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<Page<Post>>> getPostsByUserId(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            if (page < 0 || size <= 0) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(400, "Tham số phân trang không hợp lệ", null));
            }

            log.info("Fetching posts for user: {}, page={}, size={}", userId, page, size);
            
            var currentUser = userService.getCurrentUser();
            Long currentUserId = currentUser != null ? currentUser.getId() : null;
            
            Page<Post> posts = postService.getPostsByUserId(userId, currentUserId, page, size);
            posts.forEach(this::attachAuthorSummary);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách post thành công", posts));
        } catch (Exception e) {
            log.error("Error fetching posts", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy danh sách post: " + e.getMessage(), null));
        }
    }

    /**
     * Count total posts by user ID
     * @param userId User ID
     * @return total number of posts
     */
    @GetMapping("/user/{userId}/count")
    public ResponseEntity<ApiResponse<Long>> countPostsByUserId(@PathVariable Long userId) {
        try {
            log.info("Counting posts for user: {}", userId);
            
            var currentUser = userService.getCurrentUser();
            Long currentUserId = currentUser != null ? currentUser.getId() : null;
            
            long postCount = postService.countPostsByUserId(userId, currentUserId);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy số lượng post thành công", postCount));
        } catch (Exception e) {
            log.error("Error counting posts", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi đếm số lượng post: " + e.getMessage(), null));
        }
    }

    @GetMapping("/authors/{authorId}/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPostAuthorSummary(@PathVariable Long authorId) {
        try {
            var user = userService.findUserById(authorId);
            if (user == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(404, "Không tìm thấy tác giả", null));
            }

            Map<String, Object> author = new HashMap<>();
            author.put("id", user.getId());
            author.put("username", user.getUsername());
            author.put("name", user.getName());
            author.put("fullName", user.getName());
            author.put("avatarUrl", user.getAvatarUrl());

            return ResponseEntity.ok(ApiResponse.success(200, "Lấy thông tin tác giả thành công", author));
        } catch (Exception e) {
            log.error("Error fetching post author summary", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy thông tin tác giả: " + e.getMessage(), null));
        }
    }

    /**
     * Get post by ID
     * @param id Post ID
     * @return Post details
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Post>> getPostById(@PathVariable String id) {
        try {
            log.info("Fetching post by ID: {}", id);
            Post post = postService.getPostById(id);
            attachAuthorSummary(post);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy chi tiết post thành công", post));
        } catch (Exception e) {
            log.error("Error fetching post", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy chi tiết post: " + e.getMessage(), null));
        }
    }

    /**
     * Delete post by ID
     * Also deletes associated media from S3
     * @param id Post ID
     * @return Success message
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePost(
            @PathVariable String id) {
        try {
            // Get current user
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập để xóa post", null));
            }
            
            Long userId = currentUser.getId();
            log.info("Deleting post {} by user {}", id, userId);
            
            postService.deletePost(id, userId);
            return ResponseEntity.ok(ApiResponse.success(200, "Xóa post thành công", null));
        } catch (Exception e) {
            log.error("Error deleting post", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi xóa post: " + e.getMessage(), null));
        }
    }

    /**
     * Update a post with new images (presigned URLs)
     * @param id Post ID
     * @param postDataJson JSON string of CreatePostRequest
     * @param newImageUrls List of new image URLs from presigned upload
     * @return Updated post
     */
    @PutMapping(value = "/{id}")
    public ResponseEntity<ApiResponse<Post>> updatePost(
            @PathVariable String id,
            @RequestParam("postData") String postDataJson,
            @RequestParam(value = "imageUrls", required = false) List<String> newImageUrls) {
        try {
            // Get current user
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập để cập nhật post", null));
            }
            
            Long userId = currentUser.getId();
            log.info("Updating post {} by user {}", id, userId);
            
            // Parse JSON to CreatePostRequest
            CreatePostRequest request = objectMapper.readValue(postDataJson, CreatePostRequest.class);
            
            // Update post with presigned image URLs
            Post post = postService.updatePost(id, request, newImageUrls, userId);
            
            return ResponseEntity.ok(ApiResponse.success(200, "Cập nhật post thành công", post));
        } catch (Exception e) {
            log.error("Error updating post", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi cập nhật post: " + e.getMessage(), null));
        }
    }

    /**
     * Get posts where user is tagged
     * @param userId User ID
     * @return List of posts
     */
    @GetMapping("/tagged/{userId}")
    public ResponseEntity<ApiResponse<List<Post>>> getPostsByTaggedUserId(@PathVariable String userId) {
        try {
            log.info("Fetching posts where user {} is tagged", userId);
            List<Post> posts = postService.getPostsByTaggedUserId(userId);
            posts.forEach(this::attachAuthorSummary);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách post được tag thành công", posts));
        } catch (Exception e) {
            log.error("Error fetching tagged posts", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy danh sách post được tag: " + e.getMessage(), null));
        }
    }

    /**
     * Sync stats for all posts from reactions and comments
     * @return Success message
     */
    @PostMapping("/sync-stats")
    public ResponseEntity<ApiResponse<String>> syncAllPostsStats() {
        try {
            log.info("Syncing stats for all posts");
            postService.syncAllPostsStats();
            return ResponseEntity.ok(ApiResponse.success(200, "Đồng bộ thống kê cho tất cả posts thành công", "OK"));
        } catch (Exception e) {
            log.error("Error syncing posts stats", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi đồng bộ thống kê: " + e.getMessage(), null));
        }
    }

    private void attachAuthorSummary(Post post) {
        if (post == null || post.getAuthorId() == null) {
            return;
        }

        try {
            post.setAuthorSummary(buildAuthorSummary(Long.parseLong(post.getAuthorId())));
        } catch (Exception e) {
            log.warn("Cannot attach author summary for post {} author {}", post.getId(), post.getAuthorId());
        }
    }

    private Map<String, Object> buildAuthorSummary(Long authorId) {
        User user = userService.findUserById(authorId);
        if (user == null) {
            return null;
        }

        Map<String, Object> author = new HashMap<>();
        author.put("id", user.getId());
        author.put("username", user.getUsername());
        author.put("name", user.getName());
        author.put("fullName", user.getName());
        author.put("avatarUrl", user.getAvatarUrl());
        return author;
    }
}
