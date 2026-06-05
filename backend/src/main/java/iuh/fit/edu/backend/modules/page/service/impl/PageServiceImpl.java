package iuh.fit.edu.backend.modules.page.service.impl;

import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.entity.PageFollow;
import iuh.fit.edu.backend.modules.page.entity.PageLike;
import iuh.fit.edu.backend.modules.page.entity.PagePost;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestCreatePage;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestUpdatePage;
import iuh.fit.edu.backend.modules.page.mapper.PageMapper;
import iuh.fit.edu.backend.modules.page.repository.PageFollowRepository;
import iuh.fit.edu.backend.modules.page.repository.PageLikeRepository;
import iuh.fit.edu.backend.modules.page.repository.PagePostRepository;
import iuh.fit.edu.backend.modules.page.repository.PageRepository;
import iuh.fit.edu.backend.modules.page.service.PageService;
import iuh.fit.edu.backend.modules.page.service.PageNotificationService;
import iuh.fit.edu.backend.modules.post.repository.PostRepository;
import iuh.fit.edu.backend.modules.user.service.UserService;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import iuh.fit.edu.backend.modules.page.event.publisher.PageEventPublisher;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PageServiceImpl implements PageService {
    PageRepository pageRepository;
    PageFollowRepository pageFollowRepository;
    PageLikeRepository pageLikeRepository;
    PagePostRepository pagePostRepository;
    PostRepository postRepository;
    PageMapper pageMapper;
    UserService userService;
    S3Service s3Service;
    PageEventPublisher pageEventPublisher;
    PageNotificationService pageNotificationService;

    public PageServiceImpl(PageFollowRepository pageFollowRepositoryl,
                           PageLikeRepository pageLikeRepository,
                           PagePostRepository pagePostRepository,
                           PostRepository postRepository,
                           PageMapper pageMapper,
                           PageRepository pageRepository,
                           UserService userService,
                           S3Service s3Service,
                           PageEventPublisher pageEventPublisher,
                           PageNotificationService pageNotificationService) {
        this.pageFollowRepository = pageFollowRepositoryl;
        this.pageLikeRepository = pageLikeRepository;
        this.pagePostRepository = pagePostRepository;
        this.postRepository = postRepository;
        this.pageMapper = pageMapper;
        this.pageRepository = pageRepository;
        this.userService = userService;
        this.s3Service = s3Service;
        this.pageEventPublisher = pageEventPublisher;
        this.pageNotificationService = pageNotificationService;
    }

    @Override
    public Page createPage(long userId, UserRequestCreatePage createPage) {
        Page page = pageMapper.CreateRequestPagetoPage(createPage);
        User user = userService.findUserById(userId);

        if (page != null) {
            page.setCreatedBy(user);
            // Tự gán username của page = username người tạo (cho phép trùng,
            // không yêu cầu unique). Bỏ qua giá trị username client gửi lên.
            if (user != null) {
                page.setUsername(user.getUsername());
            }
            page.setCreatedAt(OffsetDateTime.now());
            Page saved = pageRepository.save(page);
            // Publish PAGE_CREATED so all clients update their list
            pageEventPublisher.publishPageCreated(saved.getId(), saved);
            return saved;
        }
        return null;
    }

    @Override
    public boolean deletePage(long id) {
        if (id > 0) {
            // Get the page first
            Page page = pageRepository.findById(id).orElse(null);
            if (page != null && page.getPagePosts() != null) {
                // Delete the actual Post documents from MongoDB before deleting PagePost records
                for (PagePost pagePost : page.getPagePosts()) {
                    if (pagePost.getPostId() != null) {
                        postRepository.deleteById(pagePost.getPostId());
                    }
                }
            }
            
            // Delete the page (which will cascade delete page_posts, page_members, page_follows, page_likes due to CascadeType.ALL)
            pageRepository.deleteById(id);
            
            // Publish PAGE_DELETED
            pageEventPublisher.publishPageDeleted(id);
            return true;
        }
        return false;
    }

    @Override
    public boolean updatePage(long id, UserRequestUpdatePage updatePage) {
        Page page = findPageById(id);
        if (page != null) {
            if (updatePage.getName() != null) page.setName(updatePage.getName());
            if (updatePage.getUsername() != null) page.setUsername(updatePage.getUsername());
            if (updatePage.getCategory() != null) page.setCategory(updatePage.getCategory());
            if (updatePage.getDescription() != null) page.setDescription(updatePage.getDescription());
            if (updatePage.getAvatarUrl() != null) page.setAvatarUrl(updatePage.getAvatarUrl());
            if (updatePage.getCoverUrl() != null) page.setCoverUrl(updatePage.getCoverUrl());
            if (updatePage.getPhone() != null) page.setPhone(updatePage.getPhone());
            if (updatePage.getEmail() != null) page.setEmail(updatePage.getEmail());
            if (updatePage.getWebsite() != null) page.setWebsite(updatePage.getWebsite());
            if (updatePage.getAddress() != null) page.setAddress(updatePage.getAddress());
            if (updatePage.getIsVerified() != null) page.setIsVerified(updatePage.getIsVerified());
            if (updatePage.getStatus() != null) page.setStatus(updatePage.getStatus());
            page.setUpdatedAt(OffsetDateTime.now());
            Page saved = pageRepository.save(page);
            // Publish PAGE_UPDATED
            pageEventPublisher.publishPageUpdated(saved.getId(), saved);
            return true;
        }

        return false;
    }

    @Override
    public Page findPageById(long id) {
        return pageRepository.findById(id).orElse(null);
    }

    @Override
    public List<Page> findAllPages() {
        return pageRepository.findAll();
    }

    @Override
    public List<Page> findAllPagesForUser(long userId) {
        List<Page> pages = pageRepository.findAll();
        for (Page page : pages) {
            long pageId = page.getId();
            page.setLikeCount(pageLikeRepository.countByPage_Id(pageId));
            page.setFollowCount(pageFollowRepository.countByPage_Id(pageId));
            page.setIsLiked(pageLikeRepository.existsByUser_IdAndPage_Id(userId, pageId));
            page.setIsFollowing(pageFollowRepository.existsByUser_IdAndPage_Id(userId, pageId));
        }
        return pages;
    }

    @Override
    public List<Page> findPagesByUserId(long userId) {
        return pageRepository.findByCreatedBy_Id(userId);
    }


    @Override
    @Transactional
    public boolean followPageUser(long userId, long pageId) {
        // Prevent duplicate follow
        if (pageFollowRepository.existsByUser_IdAndPage_Id(userId, pageId)) {
            return true;
        }
        Page page = findPageById(pageId);
        User user = userService.findUserById(userId);
        if (user != null && page != null) {
            PageFollow pageFollow = new PageFollow();
            pageFollow.setUser(user);
            pageFollow.setPage(page);
            pageFollow.setFollowedAt(OffsetDateTime.now());
            pageFollowRepository.save(pageFollow);

            // Notify page admins/moderators about the new follower
            pageNotificationService.notifyAdmins(page, userId,
                    NotificationType.PAGE_FOLLOW,
                    "đã theo dõi trang " + page.getName());
            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean likePageUser(long userId, long pageId) {
        // Prevent duplicate like
        if (pageLikeRepository.existsByUser_IdAndPage_Id(userId, pageId)) {
            return true;
        }
        Page page = findPageById(pageId);
        User user = userService.findUserById(userId);
        if (user != null && page != null) {
            PageLike pageLike = new PageLike();
            pageLike.setUser(user);
            pageLike.setPage(page);
            pageLike.setLikedAt(OffsetDateTime.now());
            pageLikeRepository.save(pageLike);

            // Notify page admins/moderators about the new like
            pageNotificationService.notifyAdmins(page, userId,
                    NotificationType.PAGE_LIKE,
                    "đã thích trang " + page.getName());
            return true;
        }
        return false;
    }

    @Override
    public boolean cancelFollowPageUser(long userId, long pageId) {
        PageFollow pageFollow = pageFollowRepository.findPageFollowByUser_IdAndPage_Id(userId, pageId);
        if (pageFollow != null) {
            pageFollowRepository.deleteById(pageFollow.getId());
            return true;
        }
        return false;

    }

    @Override
    public boolean cancelLikePageUser(long userId, long pageId) {
        PageLike pageLike = pageLikeRepository.findPageLikeByUser_IdAndPage_Id(userId, pageId);
        if (pageLike != null) {
            pageLikeRepository.deleteById(pageLike.getId());
            return true;
        }
        return false;
    }

    @Override
    public Map<String, Object> getPageInteractionStatus(long userId, long pageId) {
        Map<String, Object> status = new HashMap<>();
        status.put("likeCount", pageLikeRepository.countByPage_Id(pageId));
        status.put("followCount", pageFollowRepository.countByPage_Id(pageId));
        status.put("isLiked", pageLikeRepository.existsByUser_IdAndPage_Id(userId, pageId));
        status.put("isFollowing", pageFollowRepository.existsByUser_IdAndPage_Id(userId, pageId));
        return status;
    }
}
