package iuh.fit.edu.backend.service.ai;

import iuh.fit.edu.backend.dto.ai.AISuggestionRequest;
import iuh.fit.edu.backend.dto.ai.AISuggestionResponse;
import iuh.fit.edu.backend.dto.ai.AISummarizeRequest;
import iuh.fit.edu.backend.dto.ai.AISummarizeResponse;

public interface AIChatService {
    AISummarizeResponse summarizeConversation(AISummarizeRequest request);

    AISuggestionResponse suggestReplies(AISuggestionRequest request);
}
