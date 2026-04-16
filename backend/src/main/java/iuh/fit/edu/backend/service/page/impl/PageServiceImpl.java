package iuh.fit.edu.backend.service.page.impl;

import iuh.fit.edu.backend.domain.entity.mysql.Page;
import iuh.fit.edu.backend.domain.entity.mysql.PageFollow;
import iuh.fit.edu.backend.domain.entity.mysql.PageLike;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.page.UserRequestCreatePage;
import iuh.fit.edu.backend.dto.request.page.UserRequestUpdatePage;
import iuh.fit.edu.backend.mapper.PageMapper;
import iuh.fit.edu.backend.repository.mysql.PageFollowRepository;
import iuh.fit.edu.backend.repository.mysql.PageLikeRepository;
import iuh.fit.edu.backend.repository.mysql.PageRepository;
import iuh.fit.edu.backend.service.page.PageService;
import iuh.fit.edu.backend.service.user.UserService;
import iuh.fit.edu.backend.service.s3.S3Service;
import org.springframework.stereotype.Service;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PageServiceImpl implements PageService {
    PageRepository pageRepository;
    PageFollowRepository pageFollowRepository;
    PageLikeRepository pageLikeRepository;
    PageMapper pageMapper;
    UserService userService;
    S3Service s3Service;

    public PageServiceImpl(PageFollowRepository pageFollowRepositoryl,
                           PageLikeRepository pageLikeRepository, PageMapper pageMapper,
                           PageRepository pageRepository,
                           UserService userService,S3Service s3Service) {
        this.pageFollowRepository = pageFollowRepositoryl;
        this.pageLikeRepository = pageLikeRepository;
        this.pageMapper = pageMapper;
        this.pageRepository = pageRepository;
        this.userService = userService;
        this.s3Service = s3Service;
    }

    @Override
    public Page createPage(long userId, UserRequestCreatePage createPage) {
        Page page=pageMapper.CreateRequestPagetoPage(createPage);
        User user=userService.findUserById(userId);

        if(page!=null){
            page.setCreatedBy(user);
            page.setCreatedAt(OffsetDateTime.now());
            return pageRepository.save(page);
        }
        return null;
    }

    @Override
    public boolean deletePage(long id) {
        if(id>0){
            pageRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Override
    public boolean updatePage(long id,UserRequestUpdatePage updatePage) {
        Page page=findPageById(id);
        if(page!=null){
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
            page.setUpdatedAt(OffsetDateTime.now());
            pageRepository.save(page);
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
    public List<Page> findPagesByUserId(long userId) {
        return pageRepository.findByCreatedBy_Id(userId);
    }


    @Override
    public boolean followPageUser(long userId, long pageId) {
        // Prevent duplicate follow
        if (pageFollowRepository.existsByUser_IdAndPage_Id(userId, pageId)) {
            return true;
        }
        Page page=findPageById(pageId);
        User user=userService.findUserById(userId);
        if (user!=null && page!=null){
            PageFollow pageFollow=new PageFollow();
            pageFollow.setUser(user);
            pageFollow.setPage(page);
            pageFollow.setFollowedAt(OffsetDateTime.now());
            pageFollowRepository.save(pageFollow);
            return true;
        }
        return false;
    }

    @Override
    public boolean likePageUser(long userId, long pageId) {
        // Prevent duplicate like
        if (pageLikeRepository.existsByUser_IdAndPage_Id(userId, pageId)) {
            return true;
        }
        Page page=findPageById(pageId);
        User user=userService.findUserById(userId);
        if (user!=null && page!=null){
            PageLike pageLike=new PageLike();
            pageLike.setUser(user);
            pageLike.setPage(page);
            pageLike.setLikedAt(OffsetDateTime.now());
            pageLikeRepository.save(pageLike);
            return true;
        }
        return false;
    }

    @Override
    public boolean cancelFollowPageUser(long userId, long pageId) {
        PageFollow pageFollow=pageFollowRepository.findPageFollowByUser_IdAndPage_Id(userId,pageId);
        if (pageFollow!=null){
            pageFollowRepository.deleteById(pageFollow.getId());
            return true;
        }
        return false;

    }

    @Override
    public boolean cancelLikePageUser(long userId, long pageId) {
        PageLike pageLike=pageLikeRepository.findPageLikeByUser_IdAndPage_Id(userId,pageId);
        if (pageLike!=null){
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
