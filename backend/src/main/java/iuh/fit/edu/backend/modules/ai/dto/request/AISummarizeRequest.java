package iuh.fit.edu.backend.modules.ai.dto.request;

import iuh.fit.edu.backend.modules.ai.dto.response.MessagePreviewDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AISummarizeRequest {
    @NotNull(message = "conversationId là bắt buộc")
    private Long conversationId;

    @Min(value = 1, message = "limit phải lớn hơn hoặc bằng 1")
    @Max(value = 100, message = "limit không được vượt quá 100")
    private Integer limit = 30;

    @Valid
    private List<MessagePreviewDTO> messages;
}
