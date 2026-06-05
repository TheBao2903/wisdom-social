package iuh.fit.edu.backend.modules.chat.dto.request.poll;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class CreatePollRequest {
    @NotNull
    private Long conversationId;

    @NotBlank
    @Size(max = 255)
    private String title;

    @NotEmpty
    @Size(min = 2, max = 20)
    private List<@NotBlank @Size(max = 255) String> options;

    private boolean allowMultipleChoices;
    private boolean allowAddOption;
    private boolean anonymous;
    private Instant expiresAt;
}
