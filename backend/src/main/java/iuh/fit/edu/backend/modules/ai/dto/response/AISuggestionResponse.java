package iuh.fit.edu.backend.modules.ai.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
public class AISuggestionResponse {
    private Long conversationId;
    private List<String> suggestions;
    private Instant generatedAt;
}
