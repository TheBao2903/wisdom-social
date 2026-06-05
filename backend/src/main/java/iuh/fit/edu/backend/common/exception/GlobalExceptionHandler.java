/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.exception;


import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.ai.dto.response.AIErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AIConsentRequiredException.class)
    public ResponseEntity<ApiResponse<Object>> handleAIConsentRequired(AIConsentRequiredException ex) {
        return buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage(), "AI_CONSENT_REQUIRED");
    }

    @ExceptionHandler(ConversationNotFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleConversationNotFound(ConversationNotFoundException ex) {
        return buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage(), "CONVERSATION_NOT_FOUND");
    }

    @ExceptionHandler(ConversationAccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleConversationAccessDenied(ConversationAccessDeniedException ex) {
        return buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage(), "CONVERSATION_ACCESS_DENIED");
    }

    @ExceptionHandler(ConversationMemberKickedException.class)
    public ResponseEntity<ApiResponse<Object>> handleConversationMemberKicked(ConversationMemberKickedException ex) {
        return buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage(), "CONVERSATION_MEMBER_KICKED");
    }

    @ExceptionHandler(InvalidAIRequestException.class)
    public ResponseEntity<ApiResponse<Object>> handleInvalidAIRequest(InvalidAIRequestException ex) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage(), "INVALID_AI_REQUEST");
    }
    @ExceptionHandler(ConversationMemberLeftException.class)
    public ResponseEntity<ApiResponse<Object>> handleConversationMemberLeft(ConversationMemberLeftException ex) {
        return buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage(), "CONVERSATION_MEMBER_LEFT");
    }

    @ExceptionHandler(MaxPinLimitException.class)
    public ResponseEntity<ApiResponse<Object>> handleMaxPinLimit(MaxPinLimitException ex) {
        return buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage(), "MAX_PIN_LIMIT");
    }

    @ExceptionHandler(ExternalAIServiceException.class)
    public ResponseEntity<ApiResponse<Object>> handleExternalAIService(ExternalAIServiceException ex) {
        LOGGER.warn("External AI service error: {}", ex.getMessage());
        return buildErrorResponse(HttpStatus.BAD_GATEWAY, ex.getMessage(), "EXTERNAL_AI_SERVICE_ERROR");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidationError(MethodArgumentNotValidException ex) {
        Map<String, String> validationErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> validationErrors.put(error.getField(), error.getDefaultMessage()));

        AIErrorResponse errorResponse = AIErrorResponse.builder()
                .code("VALIDATION_ERROR")
                .message("Dữ liệu gửi lên không hợp lệ")
                .timestamp(Instant.now())
                .build();

        ApiResponse<Object> apiResponse = ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "Dữ liệu gửi lên không hợp lệ",
                Map.of("error", errorResponse, "details", validationErrors));

        return ResponseEntity.badRequest().body(apiResponse);
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ApiResponse<Object>> handleRateLimit(RateLimitExceededException ex) {
        Map<String, Object> errorData = new HashMap<>();
        errorData.put("code", "RATE_LIMIT_EXCEEDED");
        errorData.put("remainingSeconds", ex.getRemainingSeconds());
        ApiResponse<Object> response = ApiResponse.error(429, ex.getMessage(), errorData);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
    }

    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccountLocked(AccountLockedException ex) {
        Map<String, Object> errorData = new HashMap<>();
        errorData.put("code", "ACCOUNT_LOCKED");
        errorData.put("remainingSeconds", ex.getRemainingSeconds());
        errorData.put("lockReason", ex.getLockReason());
        ApiResponse<Object> response = ApiResponse.error(403, ex.getMessage(), errorData);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDenied(AccessDeniedException ex) {
        return buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage(), "ACCESS_DENIED");
    }

//    @ExceptionHandler(Exception.class)
//    public ResponseEntity<ApiResponse<Object>> handleException(Exception ex) {
//        LOGGER.error("Unhandled exception caught in GlobalExceptionHandler", ex);
//        return buildErrorResponse(
//                HttpStatus.INTERNAL_SERVER_ERROR,
//                "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau",
//                "INTERNAL_SERVER_ERROR");
//    }

    private ResponseEntity<ApiResponse<Object>> buildErrorResponse(HttpStatus status, String message, String code) {
        AIErrorResponse errorResponse = AIErrorResponse.builder()
                .code(code)
                .message(message)
                .timestamp(Instant.now())
                .build();

        ApiResponse<Object> apiResponse = ApiResponse.error(
                status.value(),
                message,
                errorResponse);
        return ResponseEntity.status(status).body(apiResponse);
    }
}
