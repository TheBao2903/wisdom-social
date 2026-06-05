package iuh.fit.edu.backend.modules.ai.service;

import iuh.fit.edu.backend.modules.ai.dto.request.AISuggestionRequest;
import iuh.fit.edu.backend.modules.ai.dto.response.AISuggestionResponse;
import iuh.fit.edu.backend.modules.ai.dto.request.AISummarizeRequest;
import iuh.fit.edu.backend.modules.ai.dto.response.AISummarizeResponse;

public interface AIChatService {
    AISummarizeResponse summarizeConversation(AISummarizeRequest request);

    AISuggestionResponse suggestReplies(AISuggestionRequest request);
}
