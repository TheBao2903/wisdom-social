package iuh.fit.edu.backend.modules.post.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.post.dto.response.CommentResponse;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
public class CommentEvent {
    private String action; // "CREATE" or "DELETE"
    private String postId;
    private CommentResponse payload;
    @Builder.Default
    private DomainEventType domainEventType = DomainEventType.COMMENT;

    @JsonCreator
    public CommentEvent(
            @JsonProperty("action") String action,
            @JsonProperty("postId") String postId,
            @JsonProperty("payload") CommentResponse payload,
            @JsonProperty("domainEventType") DomainEventType domainEventType) {
        this.action = action;
        this.postId = postId;
        this.payload = payload;
        this.domainEventType = domainEventType != null ? domainEventType : DomainEventType.COMMENT;
    }

    public CommentEvent(String action, String postId, CommentResponse payload) {
        this.action = action;
        this.postId = postId;
        this.payload = payload;
        this.domainEventType = DomainEventType.COMMENT;
    }
}
