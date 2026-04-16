package iuh.fit.edu.backend.service.page;

import iuh.fit.edu.backend.domain.entity.mysql.PagePost;
import iuh.fit.edu.backend.domain.entity.nosql.Post;
import org.bson.types.ObjectId;
import java.util.List;

public interface PagePostService {
    boolean approvePostPage(long userId,long pageId, ObjectId postId);
    boolean cancelApprovePostPage(long userId,long pageId, ObjectId postId);
    boolean addPostPage(long userId, long pageId, Post post);
    boolean removePostPage(long userId, long pageId, ObjectId postId);
    List<Post> getAllPostOfPage(long pageId);
    List<Post> getAllPostWaitingForApproveOfPage(long userId, long pageId);
    boolean approveAllPostPage(long userId, long pageId);
    boolean cancelAllPostPage(long userId, long pageId);
    PagePost getPagePostByIdandPostId(long pageId, ObjectId postId);
}
