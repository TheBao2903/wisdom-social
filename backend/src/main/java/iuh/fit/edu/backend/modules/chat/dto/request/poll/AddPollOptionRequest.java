package iuh.fit.edu.backend.modules.chat.dto.request.poll;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AddPollOptionRequest {
    @NotBlank
    @Size(max = 255)
    private String text;
}
