package iuh.fit.edu.backend.modules.chat.dto.response.poll;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PollResponse {
    private String id;
    private String messageId;
    private Long conversationId;
    private Long creatorId;
    private String title;
    private boolean allowMultipleChoices;
    private boolean allowAddOption;
    private boolean anonymous;
    private boolean closed;
    private boolean recalled;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant updatedAt;
    private int totalVoterCount;
    private int totalVoteCount;
    private List<String> currentUserOptionIds;
    private List<OptionResponse> options;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionResponse {
        private String id;
        private String text;
        private int voteCount;
        private boolean selectedByCurrentUser;

        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Set<Long> voterIds;
    }
}
