package iuh.fit.edu.backend.modules.post.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
public class PostEvent implements Serializable {
    private String action; // CREATE, UPDATE, DELETE
    private Post post;
    private String postId;
    private String authorId;      // Post author
    private String actorId;       // Who triggered the activity (reactor/commenter)
    private Instant lastActivityAt;
    @Builder.Default
    private DomainEventType domainEventType = DomainEventType.POST;

    @JsonCreator
    public PostEvent(
            @JsonProperty("action") String action,
            @JsonProperty("post") Post post,
            @JsonProperty("postId") String postId,
            @JsonProperty("authorId") String authorId,
            @JsonProperty("actorId") String actorId,
            @JsonProperty("lastActivityAt") Instant lastActivityAt,
            @JsonProperty("domainEventType") DomainEventType domainEventType) {
        this.action = action;
        this.post = post;
        this.postId = postId;
        this.authorId = authorId;
        this.actorId = actorId;
        this.lastActivityAt = lastActivityAt;
        this.domainEventType = domainEventType != null ? domainEventType : DomainEventType.POST;
    }

    public PostEvent(String action, Post post, String postId, String authorId, Instant lastActivityAt) {
        this.action = action;
        this.post = post;
        this.postId = postId;
        this.authorId = authorId;
        this.lastActivityAt = lastActivityAt;
        this.domainEventType = DomainEventType.POST;
    }
}
