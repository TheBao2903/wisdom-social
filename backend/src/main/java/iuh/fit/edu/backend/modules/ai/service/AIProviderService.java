package iuh.fit.edu.backend.modules.ai.service;

import iuh.fit.edu.backend.modules.ai.dto.response.MessagePreviewDTO;

import java.util.List;

public interface AIProviderService {
    String generateSummary(List<MessagePreviewDTO> messages);

    List<String> generateReplySuggestions(List<MessagePreviewDTO> messages, int suggestionCount);
}
