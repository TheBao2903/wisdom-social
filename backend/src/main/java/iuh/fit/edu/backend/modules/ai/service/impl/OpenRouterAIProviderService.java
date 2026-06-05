package iuh.fit.edu.backend.modules.ai.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.common.config.AIProperties;
import iuh.fit.edu.backend.modules.ai.dto.response.MessagePreviewDTO;
import iuh.fit.edu.backend.common.exception.ExternalAIServiceException;
import iuh.fit.edu.backend.modules.ai.service.AIProviderService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class OpenRouterAIProviderService implements AIProviderService {

    private static final Pattern PREFIX_PATTERN = Pattern.compile("^[-\\d.)\\s]+");

    private final WebClient aiWebClient;
    private final AIProperties aiProperties;
    private final ObjectMapper objectMapper;

    public OpenRouterAIProviderService(WebClient.Builder webClientBuilder, AIProperties aiProperties,
            ObjectMapper objectMapper) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;

        WebClient.Builder builder = webClientBuilder
                .baseUrl(aiProperties.getBaseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

        if (StringUtils.hasText(aiProperties.getApiKey())) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + aiProperties.getApiKey());
        }

        this.aiWebClient = builder.build();
    }

    @Override
    public String generateSummary(List<MessagePreviewDTO> messages) {
        String prompt = buildConversationPayload(messages);
        String rawContent = callChatCompletion(
                buildSummarySystemPrompt(),
                "Dữ liệu hội thoại:\n" + prompt,
                280);

        String summary = extractSummary(rawContent);
        if (!StringUtils.hasText(summary)) {
            throw new ExternalAIServiceException("AI provider không trả về nội dung tóm tắt hợp lệ");
        }
        return summary;
    }

    @Override
    public List<String> generateReplySuggestions(List<MessagePreviewDTO> messages, int suggestionCount) {
        String prompt = buildConversationPayload(messages);
        String rawContent = callChatCompletion(
                buildSuggestionSystemPrompt(suggestionCount),
                "Dữ liệu hội thoại:\n" + prompt,
                220);

        List<String> suggestions = extractSuggestions(rawContent)
                .stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .limit(3)
                .toList();

        if (suggestions.size() < 2) {
            throw new ExternalAIServiceException("AI provider không trả đủ 2-3 gợi ý");
        }

        return suggestions;
    }

    private String callChatCompletion(String systemPrompt, String userPrompt, int maxTokens) {
        if (!StringUtils.hasText(aiProperties.getBaseUrl())) {
            throw new ExternalAIServiceException("AI provider chưa được cấu hình base-url");
        }

        if (!StringUtils.hasText(aiProperties.getApiKey())) {
            throw new ExternalAIServiceException("AI provider chưa được cấu hình API key");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("model",
                StringUtils.hasText(aiProperties.getModel()) ? aiProperties.getModel() : "openai/gpt-4o-mini");
        payload.put("temperature", 0.2);
        payload.put("max_tokens", maxTokens);
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)));

        String responseBody = aiWebClient.post()
                .uri("/chat/completions")
                .bodyValue(payload)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response -> response.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(errorBody -> new ExternalAIServiceException(
                                buildHttpErrorMessage(response.statusCode().value(), errorBody))))
                .bodyToMono(String.class)
                .timeout(aiProperties.getTimeout())
                .onErrorMap(WebClientResponseException.class,
                        ex -> new ExternalAIServiceException(
                                buildHttpErrorMessage(ex.getStatusCode().value(), ex.getResponseBodyAsString()),
                                ex))
                .onErrorMap(ex -> ex instanceof ExternalAIServiceException
                        ? ex
                        : new ExternalAIServiceException("Không thể kết nối AI provider", ex))
                .block();

        if (!StringUtils.hasText(responseBody)) {
            throw new ExternalAIServiceException("AI provider không phản hồi dữ liệu");
        }

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String content = root.path("choices").path(0).path("message").path("content").asText();
            if (!StringUtils.hasText(content)) {
                throw new ExternalAIServiceException("AI provider không trả về nội dung");
            }
            return content.trim();
        } catch (ExternalAIServiceException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ExternalAIServiceException("Không thể phân tích phản hồi từ AI provider", ex);
        }
    }

    private String extractSummary(String rawContent) {
        JsonNode parsedJson = tryParseJson(rawContent);
        if (parsedJson != null) {
            String summary = parsedJson.path("summary").asText();
            if (StringUtils.hasText(summary)) {
                return summary.trim();
            }
        }

        return rawContent.trim();
    }

    private List<String> extractSuggestions(String rawContent) {
        JsonNode parsedJson = tryParseJson(rawContent);
        if (parsedJson != null && parsedJson.path("suggestions").isArray()) {
            List<String> parsedSuggestions = new ArrayList<>();
            for (JsonNode node : parsedJson.path("suggestions")) {
                String cleaned = cleanSuggestion(node.asText());
                if (StringUtils.hasText(cleaned)) {
                    parsedSuggestions.add(cleaned);
                }
            }
            if (!parsedSuggestions.isEmpty()) {
                return parsedSuggestions;
            }
        }

        return rawContent.lines()
                .map(this::cleanSuggestion)
                .filter(StringUtils::hasText)
                .toList();
    }

    private JsonNode tryParseJson(String rawContent) {
        try {
            return objectMapper.readTree(rawContent);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String cleanSuggestion(String rawSuggestion) {
        if (!StringUtils.hasText(rawSuggestion)) {
            return "";
        }

        String normalized = PREFIX_PATTERN.matcher(rawSuggestion.trim()).replaceFirst("").trim();
        if (normalized.length() > 180) {
            return normalized.substring(0, 180);
        }
        return normalized;
    }

    private String buildConversationPayload(List<MessagePreviewDTO> messages) {
        StringBuilder builder = new StringBuilder();
        for (MessagePreviewDTO message : messages) {
            String role = "me".equalsIgnoreCase(message.getSenderRole()) ? "me" : "other";
            String content = message.getContent() == null ? "" : message.getContent().trim();
            if (!StringUtils.hasText(content)) {
                continue;
            }

            builder.append(role)
                    .append(": ")
                    .append(content)
                    .append("\n");
        }
        return builder.toString().trim();
    }

    private String buildSummarySystemPrompt() {
        return """
                Bạn là trợ lý AI cho ứng dụng chat. BẮT BUỘC trả lời bằng tiếng Việt.
                Bạn chỉ được làm đúng 1 việc: tóm tắt nội dung hội thoại được cung cấp.
                Không trả lời kiến thức chung, không suy diễn ngoài dữ liệu chat, không thêm thông tin nhạy cảm.
                Hãy trả về DUY NHẤT JSON theo format: {"summary":"..."}.
                summary cần ngắn gọn, dễ hiểu, tối đa 4 câu.
                """;
    }

    private String buildSuggestionSystemPrompt(int suggestionCount) {
        return """
                Bạn là trợ lý AI cho ứng dụng chat. BẮT BUỘC trả lời bằng tiếng Việt.
                Bạn chỉ được làm đúng 1 việc: gợi ý câu trả lời tiếp theo dựa trên nội dung hội thoại được cung cấp.
                Không trả lời kiến thức chung, không suy diễn ngoài dữ liệu chat.
                Trả về DUY NHẤT JSON theo format: {"suggestions":["...","..."]}.
                suggestions phải là 2-3 câu ngắn tự nhiên giống người thật nhắn tin.
                Số lượng gợi ý mục tiêu: %d.
                """.formatted(Math.max(2, Math.min(3, suggestionCount)));
    }

    private String buildHttpErrorMessage(int status, String rawBody) {
        String providerMessage = extractProviderErrorMessage(rawBody);

        if (status == 401 || status == 403) {
            return StringUtils.hasText(providerMessage)
                    ? "AI provider từ chối truy cập: " + providerMessage
                    : "AI provider từ chối truy cập (kiểm tra API key)";
        }

        if (status == 429) {
            return StringUtils.hasText(providerMessage)
                    ? "AI provider đang quá tải: " + providerMessage
                    : "AI provider đang quá tải, vui lòng thử lại sau";
        }

        if (status >= 500) {
            return StringUtils.hasText(providerMessage)
                    ? "AI provider lỗi hệ thống: " + providerMessage
                    : "AI provider lỗi hệ thống, vui lòng thử lại sau";
        }

        return StringUtils.hasText(providerMessage)
                ? "AI provider trả lỗi HTTP " + status + ": " + providerMessage
                : "AI provider trả lỗi HTTP " + status;
    }

    private String extractProviderErrorMessage(String rawBody) {
        if (!StringUtils.hasText(rawBody)) {
            return "";
        }

        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String directMessage = root.path("message").asText();
            if (StringUtils.hasText(directMessage)) {
                return directMessage.trim();
            }

            String nestedMessage = root.path("error").path("message").asText();
            if (StringUtils.hasText(nestedMessage)) {
                return nestedMessage.trim();
            }
        } catch (Exception ignored) {
            // ignore parse exception and fallback to compact raw text
        }

        String compact = rawBody.replaceAll("\\s+", " ").trim();
        return compact.length() > 200 ? compact.substring(0, 200) : compact;
    }
}
