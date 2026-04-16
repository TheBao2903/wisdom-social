package iuh.fit.edu.backend.dto.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AISuggestionRequest {
    @NotNull(message = "conversationId là bắt buộc")
    private Long conversationId;

    @Min(value = 1, message = "limit phải lớn hơn hoặc bằng 1")
    @Max(value = 100, message = "limit không được vượt quá 100")
    private Integer limit = 30;

    @Min(value = 2, message = "suggestionCount phải từ 2 đến 3")
    @Max(value = 3, message = "suggestionCount phải từ 2 đến 3")
    private Integer suggestionCount = 3;

    @Valid
    private List<MessagePreviewDTO> messages;
}
