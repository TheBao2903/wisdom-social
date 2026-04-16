package iuh.fit.edu.backend.dto.ai;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class AISummarizeResponse {
    private Long conversationId;
    private String summary;
    private Instant generatedAt;
}
