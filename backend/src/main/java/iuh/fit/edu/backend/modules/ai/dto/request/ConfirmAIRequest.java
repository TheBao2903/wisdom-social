package iuh.fit.edu.backend.modules.ai.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConfirmAIRequest {
    @NotNull(message = "confirmUseAI là bắt buộc")
    private Boolean confirmUseAI;
}
