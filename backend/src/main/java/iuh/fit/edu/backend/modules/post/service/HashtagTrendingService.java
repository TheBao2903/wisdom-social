package iuh.fit.edu.backend.modules.post.service;

import iuh.fit.edu.backend.modules.post.entity.HashtagTrending;
import org.springframework.data.domain.Page;
import java.util.List;

public interface HashtagTrendingService {
    void updateHashtagOnPostCreated(String postId, String authorId, List<String> hashtags);
    void updateHashtagOnPostUpdated(String postId, String authorId, List<String> oldHashtags, List<String> newHashtags);
    void updateHashtagOnPostDeleted(String postId, List<String> hashtags);
    Page<HashtagTrending> getTrendingHashtags(int page, int size);
}
