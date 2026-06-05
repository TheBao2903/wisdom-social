package iuh.fit.edu.backend.modules.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.ai.dto.request.ConfirmAIRequest;
import iuh.fit.edu.backend.modules.ai.dto.response.ConfirmAIResponse;
import iuh.fit.edu.backend.modules.ai.service.UserAIConsentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users/me/confirm-ai")
@RequiredArgsConstructor
public class UserAIConsentController {

    private final UserAIConsentService userAIConsentService;

    @GetMapping
    public ResponseEntity<ApiResponse<ConfirmAIResponse>> getConsentStatus() {
        ConfirmAIResponse response = userAIConsentService.getConsentStatus();
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy trạng thái xác nhận AI thành công", response));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<ConfirmAIResponse>> updateConsentStatus(
            @Valid @RequestBody ConfirmAIRequest request) {
        ConfirmAIResponse response = userAIConsentService.updateConsentStatus(request);
        return ResponseEntity.ok(ApiResponse.success(200, "Cập nhật trạng thái xác nhận AI thành công", response));
    }
}
