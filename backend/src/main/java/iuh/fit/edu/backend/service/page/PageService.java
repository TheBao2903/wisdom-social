package iuh.fit.edu.backend.service.page;

import iuh.fit.edu.backend.domain.entity.mysql.Page;
import iuh.fit.edu.backend.domain.entity.nosql.Post;
import iuh.fit.edu.backend.dto.request.page.UserRequestCreatePage;
import iuh.fit.edu.backend.dto.request.page.UserRequestUpdatePage;
import org.bson.types.ObjectId;

import java.util.List;
import java.util.Map;

public interface PageService {
    Page createPage(long userId, UserRequestCreatePage createPage);
    boolean deletePage(long id);
    boolean updatePage(long pageId, UserRequestUpdatePage updatePage);
    Page findPageById(long id);
    List<Page> findAllPages();
    List<Page> findPagesByUserId(long userId);
    boolean followPageUser(long userId, long pageId);
    boolean likePageUser(long userId, long pageId);
    boolean cancelFollowPageUser(long userId, long pageId);
    boolean cancelLikePageUser(long userId, long pageId);
    Map<String, Object> getPageInteractionStatus(long userId, long pageId);
}
