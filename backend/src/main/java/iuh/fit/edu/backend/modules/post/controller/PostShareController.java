package iuh.fit.edu.backend.modules.post.controller;

import iuh.fit.edu.backend.modules.post.entity.PostShare;
import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.post.service.PostShareService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/post-shares")
@RequiredArgsConstructor
public class PostShareController {

    private final PostShareService postShareService;
    private final UserService userService;

    @PostMapping
    public ResponseEntity<ApiResponse<PostShare>> sharePost(
@RequestParam String postId,
            @RequestParam(required = false) String content) {

        var currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(401).body(ApiResponse.error(401, "Vui lòng đăng nhập để thực hiện hành động này", null));
        }
        
        PostShare share = postShareService.sharePost(String.valueOf(currentUser.getId()), postId, content);
        return ResponseEntity.ok(ApiResponse.success(200, "Chia sẻ bài viết thành công", share));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<PostShare>>> getSharedPostsByUser(@PathVariable String userId) {
        List<PostShare> shares = postShareService.getSharedPostsByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách bài viết đã chia sẻ thành công", shares));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteShare(
            @PathVariable String id,
            @RequestParam String userId) {
        postShareService.deleteShare(id, userId);
        return ResponseEntity.ok(ApiResponse.success(200, "Xóa chia sẻ thành công", null));
    }
}
