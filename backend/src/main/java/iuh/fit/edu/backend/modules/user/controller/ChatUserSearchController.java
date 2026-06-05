package iuh.fit.edu.backend.modules.user.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.user.dto.response.ChatUserSearchResponse;
import iuh.fit.edu.backend.modules.user.service.ChatUserSearchService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat-users")
@RequiredArgsConstructor
public class ChatUserSearchController {
    private final ChatUserSearchService chatUserSearchService;
    private final UserService userService;

    @GetMapping("/search-by-phone")
    public ResponseEntity<ApiResponse<ChatUserSearchResponse>> searchByPhone(@RequestParam String phone) {
        Long currentUserId = userService.getCurrentUser().getId();
        return chatUserSearchService.searchByPhone(phone, currentUserId)
                .map(result -> ResponseEntity.ok(ApiResponse.<ChatUserSearchResponse>success(200, "User found", result)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.<ChatUserSearchResponse>success(200, "User not found", null)));
    }

    @GetMapping("/{userId}/relationship")
    public ResponseEntity<ApiResponse<ChatUserSearchResponse>> getRelationship(@PathVariable Long userId) {
        Long currentUserId = userService.getCurrentUser().getId();
        return chatUserSearchService.getRelationship(userId, currentUserId)
                .map(result -> ResponseEntity.ok(ApiResponse.<ChatUserSearchResponse>success(200, "User found", result)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.<ChatUserSearchResponse>success(200, "User not found", null)));
    }
}
