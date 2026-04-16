package iuh.fit.edu.backend.controller.ai;

import iuh.fit.edu.backend.dto.ai.AISuggestionRequest;
import iuh.fit.edu.backend.dto.ai.AISuggestionResponse;
import iuh.fit.edu.backend.dto.ai.AISummarizeRequest;
import iuh.fit.edu.backend.dto.ai.AISummarizeResponse;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.service.ai.AIChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIChatController {

    private final AIChatService aiChatService;

    @PostMapping("/summarize")
    public ResponseEntity<ApiResponse<AISummarizeResponse>> summarizeConversation(
            @Valid @RequestBody AISummarizeRequest request) {
        AISummarizeResponse response = aiChatService.summarizeConversation(request);
        return ResponseEntity.ok(ApiResponse.success(200, "Tóm tắt hội thoại thành công", response));
    }

    @PostMapping("/suggestions")
    public ResponseEntity<ApiResponse<AISuggestionResponse>> suggestReplies(
            @Valid @RequestBody AISuggestionRequest request) {
        AISuggestionResponse response = aiChatService.suggestReplies(request);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy gợi ý trả lời thành công", response));
    }
}
