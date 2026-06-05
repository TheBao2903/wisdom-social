package iuh.fit.edu.backend.modules.post.service;

import iuh.fit.edu.backend.modules.post.entity.PostShare;
import java.util.List;

public interface PostShareService {
    PostShare sharePost(String userId, String postId, String content);
    List<PostShare> getSharedPostsByUserId(String userId);
    void deleteShare(String shareId, String userId);
}
