package iuh.fit.edu.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessagePreviewDTO {
    @NotBlank(message = "senderRole không được để trống")
    private String senderRole;

    @NotBlank(message = "content không được để trống")
    private String content;

    private Instant createdAt;
}
