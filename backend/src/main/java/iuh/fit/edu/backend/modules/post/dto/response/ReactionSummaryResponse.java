package iuh.fit.edu.backend.modules.post.dto.response;

import iuh.fit.edu.backend.modules.post.constant.ReactionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReactionSummaryResponse {
    private long totalCount;
    private List<ReactionCountItem> topReactions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReactionCountItem {
        private ReactionType type;
        private long count;
    }
}
