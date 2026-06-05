package iuh.fit.edu.backend.modules.ai.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class AIErrorResponse {
    private String code;
    private String message;
    private Instant timestamp;
}
