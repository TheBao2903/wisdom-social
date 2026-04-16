package iuh.fit.edu.backend.service.page.impl;

import iuh.fit.edu.backend.constant.MemberStatus;
import iuh.fit.edu.backend.constant.PageRole;
import iuh.fit.edu.backend.constant.PageStatus;
import iuh.fit.edu.backend.domain.entity.mysql.BlockedUser;
import iuh.fit.edu.backend.domain.entity.mysql.Page;
import iuh.fit.edu.backend.domain.entity.mysql.PageMember;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.page.PageJoinRequest;
import iuh.fit.edu.backend.dto.request.page.UserRequestMemberPage;
import iuh.fit.edu.backend.repository.mysql.BlockUserRepository;
import iuh.fit.edu.backend.repository.mysql.PageMemberRepository;
import iuh.fit.edu.backend.service.page.PageMemberService;
import iuh.fit.edu.backend.service.page.PageService;
import iuh.fit.edu.backend.service.user.BlockUserService;
import iuh.fit.edu.backend.service.user.UserService;
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

    public PageMemberServiceImpl(BlockUserService blockUserService, PageMemberRepository pageMemberRepository,
                                  UserService userService, PageService pageService, BlockUserRepository blockUserRepository) {
        this.blockUserService = blockUserService;
        this.pageMemberRepository = pageMemberRepository;
        this.blockUserRepository = blockUserRepository;
        this.pageService = pageService;
        this.userService = userService;
    }

    @Override
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
            return true;

        }

        return false;
    }

    @Override
    public boolean cancelBlockMemberPage(long pageId, long userId) {
        BlockedUser blockedUser=blockUserRepository.findBlockedUserByBlockerPage_IdAndBlocked_Id(pageId,userId);
        if(blockedUser!=null){
            blockUserService.cancelBlockUser(blockedUser);
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
            pageMemberRepository.save(member);
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
}
