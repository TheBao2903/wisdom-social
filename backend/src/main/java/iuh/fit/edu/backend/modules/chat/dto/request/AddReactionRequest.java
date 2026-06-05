package iuh.fit.edu.backend.modules.chat.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddReactionRequest {
    @NotBlank(message = "Emoji không được để trống")
    private String emoji;
}
