package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateGroupImageRequest {
    @NotBlank(message = "imageUrl không được để trống")
    private String imageUrl;
}
