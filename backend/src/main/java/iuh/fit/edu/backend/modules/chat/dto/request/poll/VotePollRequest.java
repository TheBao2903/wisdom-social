package iuh.fit.edu.backend.modules.chat.dto.request.poll;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class VotePollRequest {
    @NotEmpty
    private List<String> optionIds;
}
