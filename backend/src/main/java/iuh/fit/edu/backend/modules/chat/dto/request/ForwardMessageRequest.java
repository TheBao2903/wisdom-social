package iuh.fit.edu.backend.modules.chat.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ForwardMessageRequest {
    @NotBlank(message = "Tin nhắn cần chuyển tiếp không được để trống")
    private String sourceMessageId;

    @NotEmpty(message = "Danh sách cuộc trò chuyện nhận không được để trống")
    private List<Long> targetConversationIds;
}
