package iuh.fit.edu.backend.modules.page.service;

import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestCreatePage;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestUpdatePage;

import java.util.List;
import java.util.Map;

public interface PageService {
    Page createPage(long userId, UserRequestCreatePage createPage);
    boolean deletePage(long id);
    boolean updatePage(long pageId, UserRequestUpdatePage updatePage);
    Page findPageById(long id);
    List<Page> findAllPages();
    List<Page> findAllPagesForUser(long userId);
    List<Page> findPagesByUserId(long userId);
    boolean followPageUser(long userId, long pageId);
    boolean likePageUser(long userId, long pageId);
    boolean cancelFollowPageUser(long userId, long pageId);
    boolean cancelLikePageUser(long userId, long pageId);
    Map<String, Object> getPageInteractionStatus(long userId, long pageId);
}
