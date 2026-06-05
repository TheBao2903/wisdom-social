package iuh.fit.edu.backend.modules.chat.dto.response;

import java.time.Instant;
import java.util.List;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConversationMediaResponse {
    private List<ConversationMediaItem> items;
    private Instant nextCursor;
    private boolean hasMore;
}
