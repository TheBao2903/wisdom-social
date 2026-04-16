package iuh.fit.edu.backend.service.ai;

import iuh.fit.edu.backend.dto.ai.MessagePreviewDTO;

import java.util.List;

public interface AIProviderService {
    String generateSummary(List<MessagePreviewDTO> messages);

    List<String> generateReplySuggestions(List<MessagePreviewDTO> messages, int suggestionCount);
}
