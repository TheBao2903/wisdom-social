package iuh.fit.edu.backend.modules.ai.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ConfirmAIResponse {
    private boolean confirmUseAI;
}
