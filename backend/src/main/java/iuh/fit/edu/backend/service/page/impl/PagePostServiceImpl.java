package iuh.fit.edu.backend.service.page.impl;

import iuh.fit.edu.backend.constant.PageRole;
import iuh.fit.edu.backend.constant.PostStatus;
import iuh.fit.edu.backend.domain.entity.mysql.PagePost;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.domain.entity.nosql.Post;
import iuh.fit.edu.backend.repository.mysql.PageMemberRepository;
import iuh.fit.edu.backend.repository.mysql.PagePostRepository;
import iuh.fit.edu.backend.repository.mysql.PageRepository;
import iuh.fit.edu.backend.repository.nosql.PostRepository;
import iuh.fit.edu.backend.service.page.PagePostService;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

@Service
public class PagePostServiceImpl implements PagePostService {
    private final PostRepository postRepository;
    private final PagePostRepository pagePostRepository;
    private final PageRepository pageRepository;
    private final PageMemberRepository pageMemberRepository;

    public PagePostServiceImpl(PageMemberRepository pageMemberRepository, PostRepository postRepository, PagePostRepository pagePostRepository, PageRepository pageRepository) {
        this.pageMemberRepository = pageMemberRepository;
        this.postRepository = postRepository;
        this.pagePostRepository = pagePostRepository;
        this.pageRepository = pageRepository;
    }

    @Override
    public boolean approvePostPage(long userId, long pageId, ObjectId postId) {

        if (isPageAdminOrMorderator(userId, pageId)) return false;

        PagePost pagePost = pagePostRepository
                .findByPostIdAndPage_Id(postId.toString(), pageId);

        if (pagePost == null) return false;

        pagePost.setStatus(PostStatus.APPROVED);
        pagePost.setApprovedBy(User.builder().id(userId).build());
        pagePost.setApprovedAt(OffsetDateTime.now());

        pagePostRepository.save(pagePost);

        return true;
    }

    @Override
    public boolean cancelApprovePostPage(long userId, long pageId, ObjectId postId) {

        if (isPageAdminOrMorderator(userId, pageId)) return false;

        PagePost pagePost = pagePostRepository
                .findByPostIdAndPage_Id(postId.toHexString(), pageId);

        if (pagePost == null) return false;

        pagePost.setStatus(PostStatus.REJECTED);
        pagePost.setApprovedBy(null);
        pagePost.setApprovedAt(null);

        pagePostRepository.save(pagePost);

        return true;
    }

    @Override
    public boolean addPostPage(long userId, long pageId, Post post) {

        if (!pageRepository.existsById(pageId)) return false;

        // lưu post vào Mongo
        post.setAuthorId(String.valueOf(userId));
        post.setCreatedAt(Instant.now());
        Post savedPost = postRepository.save(post);

        // lưu metadata vào SQL
        PagePost pagePost = new PagePost();
        pagePost.setPostId(savedPost.getId());
        pagePost.setPage(pageRepository.getReferenceById(pageId));
        pagePost.setStatus(PostStatus.PENDING);
        pagePost.setCreatedAt(OffsetDateTime.now());

        pagePostRepository.save(pagePost);

        return true;
    }

    @Override
    public boolean removePostPage(long userId, long pageId, ObjectId postId) {

        if (isPageAdminOrMorderator(userId, pageId)) return false;

        PagePost pagePost = pagePostRepository
                .findByPostIdAndPage_Id(postId.toHexString(), pageId);

        if (pagePost == null) return false;

        pagePostRepository.delete(pagePost);
        postRepository.deleteById(postId.toString());

        return true;
    }

    @Override
    public List<Post> getAllPostOfPage(long pageId) {
        List<PagePost> pagePostList = pagePostRepository
                .findByPage_IdAndStatus(pageId, PostStatus.APPROVED);

        pagePostList.stream()
                .map(pagePost -> postRepository.findById(pagePost.getPostId()).orElse(null))
                .toList().forEach(System.out::println);

        return pagePostList.stream()
                .map(pagePost -> postRepository.findById(pagePost.getPostId()).orElse(null))
                .toList();
    }

    @Override
    public List<Post> getAllPostWaitingForApproveOfPage(long userId, long pageId) {
        if (isPageAdminOrMorderator(userId, pageId)) return List.of();

        List<PagePost> pagePostList = pagePostRepository
                .findByPage_IdAndStatus(pageId, PostStatus.PENDING);

        return pagePostList.stream()
                .map(pagePost -> postRepository.findById(pagePost.getPostId()).orElse(null))
                .toList();
    }

    @Override
    public boolean approveAllPostPage(long userId, long pageId) {
        if (isPageAdminOrMorderator(userId, pageId)) return false;

        List<PagePost> pagePostList = pagePostRepository
                .findByPage_IdAndStatus(pageId, PostStatus.PENDING);

        pagePostList.forEach(pagePost -> {
            pagePost.setStatus(PostStatus.APPROVED);
            pagePost.setApprovedBy(User.builder().id(userId).build());
            pagePost.setApprovedAt(OffsetDateTime.now());
            pagePostRepository.save(pagePost);
        });

        return !pagePostList.isEmpty();
    }

    @Override
    public boolean cancelAllPostPage(long userId, long pageId) {
        if (isPageAdminOrMorderator(userId, pageId)) return false;

        List<PagePost> pagePostList = pagePostRepository
                .findByPage_IdAndStatus(pageId, PostStatus.PENDING);

        pagePostList.forEach(pagePost -> {
            pagePost.setStatus(PostStatus.REJECTED);
            pagePost.setApprovedBy(null);
            pagePost.setApprovedAt(null);
            pagePostRepository.save(pagePost);
        });

        return !pagePostList.isEmpty();
    }

    @Override
    public PagePost getPagePostByIdandPostId(long pageId, ObjectId postId) {
        return pagePostRepository.findPagePostByPage_IdAndPostId(pageId,postId.toString());
    }

    private boolean isPageAdminOrMorderator(long userId, long pageId) {
        return !pageMemberRepository
                .existsByUserIdAndPageIdAndRoleIn(
                        userId,
                        pageId,
                        List.of(PageRole.ADMIN, PageRole.MODERATOR)
                );
    }
}
