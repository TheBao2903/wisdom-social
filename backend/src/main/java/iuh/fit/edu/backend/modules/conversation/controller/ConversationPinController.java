package iuh.fit.edu.backend.modules.conversation.controller;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.conversation.dto.request.PinConversationRequest;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationPinResponse;
import iuh.fit.edu.backend.modules.conversation.service.ConversationPinService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pins")
@RequiredArgsConstructor
public class ConversationPinController {
    private final ConversationPinService conversationPinService;
    private final UserService userService;

    @PostMapping
    public ResponseEntity<ApiResponse<ConversationPinResponse>> pinConversation(
            @Valid @RequestBody PinConversationRequest request
    ) {
        Long userId = userService.getCurrentUser().getId();
        ConversationPinResponse response = conversationPinService.pinConversation(userId, request.getConversationId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(HttpStatus.CREATED.value(), "Ghim cuộc hội thoại thành công", response));
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> unpinConversation(@PathVariable Long conversationId) {
        Long userId = userService.getCurrentUser().getId();
        conversationPinService.unpinConversation(userId, conversationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ConversationPinResponse>>> getPinnedConversations() {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(
                ApiResponse.success(
                        HttpStatus.OK.value(),
                        "Lấy danh sách cuộc hội thoại đã ghim thành công",
                        conversationPinService.getPinnedConversations(userId)
                )
        );
    }
}
