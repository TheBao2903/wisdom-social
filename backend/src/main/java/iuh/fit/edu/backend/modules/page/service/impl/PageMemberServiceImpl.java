package iuh.fit.edu.backend.modules.page.service.impl;

import iuh.fit.edu.backend.modules.page.constant.MemberStatus;
import iuh.fit.edu.backend.modules.page.constant.PageRole;
import iuh.fit.edu.backend.modules.page.constant.PageStatus;
import iuh.fit.edu.backend.modules.user.entity.BlockedUser;
import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.entity.PageMember;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.page.dto.request.PageJoinRequest;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestMemberPage;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import iuh.fit.edu.backend.modules.page.repository.PageMemberRepository;
import iuh.fit.edu.backend.modules.page.event.publisher.PageEventPublisher;
import iuh.fit.edu.backend.modules.page.service.PageMemberService;
import iuh.fit.edu.backend.modules.page.service.PageNotificationService;
import iuh.fit.edu.backend.modules.page.service.PageService;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.user.service.BlockUserService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class PageMemberServiceImpl implements PageMemberService {
    PageService pageService;
    PageMemberRepository pageMemberRepository;
    UserService userService;
    BlockUserService blockUserService;
    BlockUserRepository blockUserRepository;
    PageEventPublisher pageEventPublisher;
    PageNotificationService pageNotificationService;

    public PageMemberServiceImpl(BlockUserService blockUserService, PageMemberRepository pageMemberRepository,
                                  UserService userService, PageService pageService,
                                  BlockUserRepository blockUserRepository, PageEventPublisher pageEventPublisher,
                                  PageNotificationService pageNotificationService) {
        this.blockUserService = blockUserService;
        this.pageMemberRepository = pageMemberRepository;
        this.blockUserRepository = blockUserRepository;
        this.pageService = pageService;
        this.userService = userService;
        this.pageEventPublisher = pageEventPublisher;
        this.pageNotificationService = pageNotificationService;
    }

    @Override
    @Transactional
    public boolean addMemberPage(UserRequestMemberPage userRequestMemberPage) {

        Page page=pageService.findPageById(userRequestMemberPage.getPageId());
        User user=userService.findUserById(userRequestMemberPage.getUserId());

        if (page!=null && user!=null){
            PageMember pageMember=new PageMember();
            pageMember.setPage(page);
            pageMember.setUser(user);
            pageMember.setStatus(MemberStatus.ACTIVE);
            pageMember.setJoinedAt(OffsetDateTime.now());
            pageMember.setRole(userRequestMemberPage.getPageRole());
            pageMemberRepository.save(pageMember);
            pageEventPublisher.publishMemberJoined(userRequestMemberPage.getPageId(), userRequestMemberPage.getUserId());

            // Notify the added user that an admin added them to the page
            long actorId = userRequestMemberPage.getUserId();
            try {
                User admin = userService.getCurrentUser();
                if (admin != null && admin.getId() != null) actorId = admin.getId();
            } catch (Exception ignored) {
                // No authenticated admin context — fall back to the added user id
            }
            pageNotificationService.notifyUser(
                    userRequestMemberPage.getUserId(), actorId, page,
                    NotificationType.PAGE_MEMBER_ADDED,
                    "Bạn đã được thêm vào trang " + page.getName());

            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean deleteMemberPage(long pageId, long userId) {
        Page page=pageService.findPageById(pageId);
        PageMember pageMember=page.getPageMembers().stream()
                .filter(x->x.getUser().getId().equals(userId)).findFirst().orElse(null);
        if (pageMember!=null){
            page.getPageMembers().remove(pageMember);
            pageMemberRepository.delete(pageMember);
            pageEventPublisher.publishMemberLeft(pageId, userId);
            return true;
        }
        return false;
    }

    @Override
    public boolean blockMemberPage(long pageId, long userId) {
        User user=userService.findUserById(userId);
        Page page=pageService.findPageById(pageId);
        if(page!=null && user!=null){

            BlockedUser blockedUser=new BlockedUser();
            blockedUser.setBlockerPage(page);
            blockedUser.setBlocked(user);
            blockUserService.blockUser(blockedUser);
            pageEventPublisher.publishMemberBlocked(pageId, userId);
            return true;

        }

        return false;
    }

    @Override
    public boolean cancelBlockMemberPage(long pageId, long userId) {
        BlockedUser blockedUser=blockUserRepository.findBlockedUserByBlockerPage_IdAndBlocked_Id(pageId,userId);
        if(blockedUser!=null){
            blockUserService.cancelBlockUser(blockedUser);
            pageEventPublisher.publishMemberUnblocked(pageId, userId);
            return true;
        }

        return false;
    }

    @Override
    public void authorizeMemberPage(long userId, long pageId,PageRole role) {
        PageMember pageMember=pageMemberRepository.findPageMemberByPage_IdAndUser_Id(pageId,userId);
        if (pageMember!=null){
            pageMember.setRole(role);
            pageMemberRepository.save(pageMember);
            pageEventPublisher.publishMemberRoleChanged(pageId, userId, role.name());
        }
    }

    @Override
    public List<PageMember> getMembersByPageId(long pageId) {
        // Only return ACTIVE members, not PENDING
        return pageMemberRepository.findByPage_IdAndStatus(pageId, MemberStatus.ACTIVE);
    }

    @Override
    @Transactional
    public boolean requestJoinPage(PageJoinRequest request) {
        Page page = pageService.findPageById(request.getPageId());
        if (page == null) {
            return false;
        }

        User user = userService.findUserById(request.getUserId());
        if (user == null) {
            return false;
        }

        if (page.getStatus() == PageStatus.PUBLIC) {
            PageMember member = new PageMember();
            member.setPage(page);
            member.setUser(user);
            member.setRole(PageRole.USER);
            member.setStatus(MemberStatus.ACTIVE);
            member.setJoinedAt(OffsetDateTime.now());
            pageMemberRepository.save(member);
            pageEventPublisher.publishMemberJoined(request.getPageId(), request.getUserId());
            return true;
        }

        // 4. If PRIVATE page, check if request already exists
        Optional<PageMember> existing = pageMemberRepository
                .findByPage_IdAndUser_Id(request.getPageId(), request.getUserId());

        if (existing.isPresent()) {
            if (existing.get().getStatus() == MemberStatus.PENDING) {
                throw new RuntimeException("Join request already sent");
            } else if (existing.get().getStatus() == MemberStatus.ACTIVE) {
                throw new RuntimeException("Already a member");
            }
        }

        // 5. Create PENDING member
        PageMember member = new PageMember();
        member.setPage(page);
        member.setUser(user);
        member.setRole(PageRole.USER);
        member.setStatus(MemberStatus.PENDING);
        member.setJoinedAt(OffsetDateTime.now());
        pageMemberRepository.save(member);
        pageEventPublisher.publishJoinRequested(request.getPageId(), request.getUserId());

        // Notify page admins/moderators about the join request
        pageNotificationService.notifyAdmins(page, request.getUserId(),
                NotificationType.PAGE_JOIN_REQUEST,
                "đã yêu cầu tham gia trang " + page.getName());

        return true;
    }

    @Override
    @Transactional
    public boolean approveJoinRequest(long pageId, long userId, long approverId) {
        if (!hasModeratorOrAdminRole(approverId, pageId)) {
            return false;
        }

        PageMember member = pageMemberRepository
                .findByPage_IdAndUser_IdAndStatus(pageId, userId, MemberStatus.PENDING)
                .orElse(null);

        if (member!=null){
            member.setStatus(MemberStatus.ACTIVE);
            member.setJoinedAt(OffsetDateTime.now());
            pageMemberRepository.save(member);
            pageEventPublisher.publishJoinApproved(pageId, userId);

            // Notify the user that their join request was approved
            Page page = pageService.findPageById(pageId);
            if (page != null) {
                pageNotificationService.notifyUser(userId, approverId, page,
                        NotificationType.PAGE_JOIN_APPROVED,
                        "Yêu cầu tham gia trang " + page.getName() + " của bạn đã được chấp nhận");
            }
            return true;
        }

        return false;
    }

    @Override
    @Transactional
    public boolean rejectJoinRequest(long pageId, long userId, long rejecterId) {
        if (!hasModeratorOrAdminRole(rejecterId, pageId)) {
            return false;
        }

        PageMember member = pageMemberRepository
                .findByPage_IdAndUser_IdAndStatus(pageId, userId, MemberStatus.PENDING)
                .orElse(null);

        if (member!=null){
            member.setStatus(MemberStatus.REJECTED);
            pageMemberRepository.deleteById(member.getId());
            pageEventPublisher.publishJoinRejected(pageId, userId);
            return true;
        }

        return false;
    }

    @Override
    @Transactional
    public boolean cancelJoinRequest(long pageId, long userId) {
        PageMember member = pageMemberRepository
                .findByPage_IdAndUser_IdAndStatus(pageId, userId, MemberStatus.PENDING)
                .orElse(null);

        if (member != null) {
            pageMemberRepository.delete(member);
            pageEventPublisher.publishJoinCancelled(pageId, userId);
            return true;
        }

        return false;
    }

    @Override
    public List<PageMember> getPendingJoinRequests(long pageId) {
        return pageMemberRepository.findByPage_IdAndStatus(pageId, MemberStatus.PENDING);
    }

    @Override
    public MemberStatus getMemberStatus(long pageId, long userId) {
        return pageMemberRepository.findByPage_IdAndUser_Id(pageId, userId)
                .map(PageMember::getStatus)
                .orElse(null);  // Not a member
    }

    @Override
    public boolean hasModeratorOrAdminRole(long userId, long pageId) {
        return pageMemberRepository.existsByUserIdAndPageIdAndRoleIn(
                userId,
                pageId,
                List.of(PageRole.ADMIN, PageRole.MODERATOR)
        );
    }

    @Override
    public long countActiveMembers(long pageId) {
        return pageMemberRepository.countByPage_IdAndStatus(pageId, MemberStatus.ACTIVE);
    }

    @Override
    public boolean canViewPageContent(long userId, long pageId) {
        Page page = pageService.findPageById(pageId);
        if (page == null) return false;
        // Public (or any non-private) pages are visible to everyone
        if (page.getStatus() != PageStatus.PRIVATE) return true;
        // Page owner can always view
        if (page.getCreatedBy() != null && page.getCreatedBy().getId() != null
                && page.getCreatedBy().getId() == userId) return true;
        // Otherwise must be an active member
        return pageMemberRepository
                .findByPage_IdAndUser_IdAndStatus(pageId, userId, MemberStatus.ACTIVE)
                .isPresent();
    }
}
