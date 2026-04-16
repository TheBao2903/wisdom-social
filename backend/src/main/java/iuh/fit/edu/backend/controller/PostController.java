/*
 * @ (#) PostController.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.domain.entity.nosql.Post;
import iuh.fit.edu.backend.dto.request.post.CreatePostRequest;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.service.post.PostService;
import iuh.fit.edu.backend.service.s3.S3Service;
import iuh.fit.edu.backend.service.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    private final ObjectMapper objectMapper;
    private final UserService userService;
    private final S3Service s3Service;

    /**
     * Get presigned upload URL for images
     * @param extension File extension (jpg, png, etc.)
     * @return Presigned URL
     */
    @GetMapping("/upload-url")
    public ResponseEntity<ApiResponse<Map<String, String>>> getPresignedUploadUrl(
            @RequestParam String extension) {
        try {
            var currentUser = userService.getCurrentUser();
            if (currentUser == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(401, "Bạn cần đăng nhập", null));
            }
            
            Map<String, String> uploadUrl = s3Service.generateUploadUrl("posts", extension);
            log.info("Alo {}", uploadUrl);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy link upload thành công", uploadUrl));
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
            log.info("Image URLs: {}", imageUrls);
            
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
     * Get all posts by user ID
     * @param userId User ID
     * @return List of posts
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<Post>>> getPostsByUserId(@PathVariable Long userId) {
        try {
            log.info("Fetching posts for user: {}", userId);
            List<Post> posts = postService.getPostsByUserId(userId);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách post thành công", posts));
        } catch (Exception e) {
            log.error("Error fetching posts", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy danh sách post: " + e.getMessage(), null));
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
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy chi tiết post thành công", post));
        } catch (Exception e) {
            log.error("Error fetching post", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy chi tiết post: " + e.getMessage(), null));
        }
    }

    /**
     * Delete post by ID
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
}
