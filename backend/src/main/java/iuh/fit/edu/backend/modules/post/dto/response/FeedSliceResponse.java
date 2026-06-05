package iuh.fit.edu.backend.modules.post.dto.response;

import iuh.fit.edu.backend.modules.post.entity.Post;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
public class FeedSliceResponse {

    private List<Post> posts;
    private Instant nextCursorCreatedAt;
    private String nextCursorPostId;
    private boolean hasNext;
}
