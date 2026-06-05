package iuh.fit.edu.backend.modules.post.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.post.entity.HashtagTrending;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.service.HashtagTrendingService;
import iuh.fit.edu.backend.modules.post.service.PostService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hashtags")
@RequiredArgsConstructor
@Slf4j
public class HashtagController {

    private final HashtagTrendingService hashtagTrendingService;
    private final PostService postService;
    private final UserService userService;

    /**
     * Get trending hashtags with pagination
     * @param page page number (0-based)
     * @param size page size
     * @return page of HashtagTrending
     */
    @GetMapping("/trending")
    public ResponseEntity<ApiResponse<Page<HashtagTrending>>> getTrendingHashtags(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            log.info("Fetching trending hashtags: page={}, size={}", page, size);
            Page<HashtagTrending> trending = hashtagTrendingService.getTrendingHashtags(page, size);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy bảng xếp hạng hashtag thịnh hành thành công", trending));
        } catch (Exception e) {
            log.error("Error fetching trending hashtags", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy bảng xếp hạng hashtag: " + e.getMessage(), null));
        }
    }

    /**
     * Get posts for a specific hashtag with pagination and privacy filtering
     * @param hashtag hashtag keyword (without # symbol)
     * @param page page number (0-based)
     * @param size page size
     * @return page of Post
     */
    @GetMapping("/posts")
    public ResponseEntity<ApiResponse<Page<Post>>> getPostsByHashtag(
            @RequestParam String hashtag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            if (hashtag == null || hashtag.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(400, "Từ khóa hashtag không được để trống", null));
            }

            log.info("Fetching posts for hashtag: {}, page={}, size={}", hashtag, page, size);

            var currentUser = userService.getCurrentUser();
            Long currentUserId = currentUser != null ? currentUser.getId() : null;

            Page<Post> posts = postService.getPostsByHashtag(hashtag, currentUserId, page, size);
            return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách bài viết theo hashtag thành công", posts));
        } catch (Exception e) {
            log.error("Error fetching posts by hashtag", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Lỗi khi lấy danh sách bài viết: " + e.getMessage(), null));
        }
    }
}
