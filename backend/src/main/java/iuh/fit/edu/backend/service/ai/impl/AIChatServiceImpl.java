package iuh.fit.edu.backend.service.ai.impl;

import iuh.fit.edu.backend.constant.MessageType;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.domain.entity.nosql.Message;
import iuh.fit.edu.backend.dto.ai.AISuggestionRequest;
import iuh.fit.edu.backend.dto.ai.AISuggestionResponse;
import iuh.fit.edu.backend.dto.ai.AISummarizeRequest;
import iuh.fit.edu.backend.dto.ai.AISummarizeResponse;
import iuh.fit.edu.backend.dto.ai.MessagePreviewDTO;
import iuh.fit.edu.backend.exception.ExternalAIServiceException;
import iuh.fit.edu.backend.exception.InvalidAIRequestException;
import iuh.fit.edu.backend.repository.nosql.MessageRepository;
import iuh.fit.edu.backend.service.ai.AIChatService;
import iuh.fit.edu.backend.service.ai.AIProviderService;
import iuh.fit.edu.backend.service.ai.UserAIConsentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AIChatServiceImpl implements AIChatService {

    private static final int DEFAULT_MESSAGE_LIMIT = 30;
    private static final int MAX_MESSAGE_LIMIT = 100;

    private final UserAIConsentService userAIConsentService;
    private final MessageRepository messageRepository;
    private final AIProviderService aiProviderService;

    @Override
    public AISummarizeResponse summarizeConversation(AISummarizeRequest request) {
        User currentUser = userAIConsentService.assertUserCanUseAI();

        List<MessagePreviewDTO> messages = resolveMessages(
                request.getConversationId(),
                request.getMessages(),
                request.getLimit(),
                currentUser.getId());

        String summary = aiProviderService.generateSummary(messages);
        if (!StringUtils.hasText(summary)) {
            throw new ExternalAIServiceException("Không thể tạo tóm tắt hội thoại từ AI provider");
        }

        return AISummarizeResponse.builder()
                .conversationId(request.getConversationId())
                .summary(summary.trim())
                .generatedAt(Instant.now())
                .build();
    }

    @Override
    public AISuggestionResponse suggestReplies(AISuggestionRequest request) {
        User currentUser = userAIConsentService.assertUserCanUseAI();

        int suggestionCount = request.getSuggestionCount() == null ? 3 : request.getSuggestionCount();
        if (suggestionCount < 2 || suggestionCount > 3) {
            throw new InvalidAIRequestException("suggestionCount phải từ 2 đến 3");
        }

        List<MessagePreviewDTO> messages = resolveMessages(
                request.getConversationId(),
                request.getMessages(),
                request.getLimit(),
                currentUser.getId());

        List<String> suggestions = aiProviderService.generateReplySuggestions(messages, suggestionCount)
                .stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .limit(3)
                .toList();

        if (suggestions.size() < 2) {
            throw new ExternalAIServiceException("AI provider không trả đủ 2-3 gợi ý phản hồi");
        }

        return AISuggestionResponse.builder()
                .conversationId(request.getConversationId())
                .suggestions(suggestions)
                .generatedAt(Instant.now())
                .build();
    }

    private List<MessagePreviewDTO> resolveMessages(
            Long conversationId,
            List<MessagePreviewDTO> requestMessages,
            Integer limit,
            Long currentUserId) {
        if (requestMessages != null) {
            if (requestMessages.isEmpty()) {
                throw new InvalidAIRequestException("Danh sách messages không được rỗng khi đã truyền lên");
            }

            List<MessagePreviewDTO> sanitizedMessages = requestMessages.stream()
                    .map(this::sanitizeRequestMessage)
                    .filter(Objects::nonNull)
                    .toList();

            if (sanitizedMessages.isEmpty()) {
                throw new InvalidAIRequestException("Không có nội dung tin nhắn hợp lệ để xử lý AI");
            }

            return sanitizedMessages;
        }

        int safeLimit = Math.max(1, Math.min(limit == null ? DEFAULT_MESSAGE_LIMIT : limit, MAX_MESSAGE_LIMIT));
        List<Message> dbMessages = messageRepository.findByConversationIdOrderByCreatedAtDesc(
                conversationId,
                PageRequest.of(0, safeLimit));

        if (dbMessages.isEmpty()) {
            throw new InvalidAIRequestException("Không có tin nhắn để xử lý AI");
        }

        List<Message> chronologicalMessages = new ArrayList<>(dbMessages);
        Collections.reverse(chronologicalMessages);

        List<MessagePreviewDTO> messagePreviews = chronologicalMessages.stream()
                .map(message -> sanitizeConversationMessage(message, currentUserId))
                .filter(Objects::nonNull)
                .toList();

        if (messagePreviews.isEmpty()) {
            throw new InvalidAIRequestException("Không có tin nhắn hợp lệ để xử lý AI");
        }

        return messagePreviews;
    }

    private MessagePreviewDTO sanitizeRequestMessage(MessagePreviewDTO requestMessage) {
        if (requestMessage == null || !StringUtils.hasText(requestMessage.getContent())) {
            return null;
        }

        String role = normalizeRole(requestMessage.getSenderRole());
        String content = normalizeContent(requestMessage.getContent());
        if (!StringUtils.hasText(content)) {
            return null;
        }

        return MessagePreviewDTO.builder()
                .senderRole(role)
                .content(content)
                .createdAt(requestMessage.getCreatedAt())
                .build();
    }

    private MessagePreviewDTO sanitizeConversationMessage(Message message, Long currentUserId) {
        String content = mapMessageContentForAI(message);
        if (!StringUtils.hasText(content)) {
            return null;
        }

        String role = (message.getSenderId() != null && message.getSenderId().equals(currentUserId))
                ? "me"
                : "other";

        return MessagePreviewDTO.builder()
                .senderRole(role)
                .content(normalizeContent(content))
                .createdAt(message.getCreatedAt())
                .build();
    }

    private String mapMessageContentForAI(Message message) {
        MessageType type = message.getMessageType();
        if (type == null) {
            return null;
        }

        return switch (type) {
            case TEXT, LINK -> message.getContent();
            case IMAGE -> "[Hình ảnh]";
            case VIDEO -> "[Video]";
            case AUDIO -> "[Tin nhắn thoại]";
            case FILE -> "[Tệp đính kèm]";
            case STICKER -> "[Sticker]";
            case CALL -> "[Cuộc gọi]";
            case SYSTEM_PIN, SYSTEM_UPIN -> null;
        };
    }

    private String normalizeRole(String senderRole) {
        if (!StringUtils.hasText(senderRole)) {
            return "other";
        }

        String lowerRole = senderRole.toLowerCase(Locale.ROOT);
        if ("me".equals(lowerRole) || "user".equals(lowerRole) || "self".equals(lowerRole)) {
            return "me";
        }
        return "other";
    }

    private String normalizeContent(String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.length() > 500) {
            return trimmed.substring(0, 500);
        }
        return trimmed;
    }
}
