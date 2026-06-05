package iuh.fit.edu.backend.modules.page.service;

import iuh.fit.edu.backend.modules.page.constant.MemberStatus;
import iuh.fit.edu.backend.modules.page.constant.PageRole;
import iuh.fit.edu.backend.modules.page.entity.PageMember;
import iuh.fit.edu.backend.modules.page.dto.request.PageJoinRequest;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestMemberPage;

import java.util.List;

public interface PageMemberService {
    boolean addMemberPage(UserRequestMemberPage userRequestMemberPage);
    boolean deleteMemberPage(long pageId, long userId);
    boolean blockMemberPage(long pageId, long userId);
    boolean cancelBlockMemberPage(long pageId, long userId);
    void authorizeMemberPage(long userId, long pageId, PageRole role);
    List<PageMember> getMembersByPageId(long pageId);

    // New methods for join request feature
    boolean requestJoinPage(PageJoinRequest request);
    boolean approveJoinRequest(long pageId, long userId, long approverId);
    boolean rejectJoinRequest(long pageId, long userId, long rejecterId);
    boolean cancelJoinRequest(long pageId, long userId);
    List<PageMember> getPendingJoinRequests(long pageId);
    MemberStatus getMemberStatus(long pageId, long userId);
    boolean hasModeratorOrAdminRole(long userId, long pageId);
    long countActiveMembers(long pageId);

    /**
     * Whether the given user may view a page's content (posts + member list).
     * Public pages are visible to everyone; PRIVATE pages only to the owner
     * and active members.
     */
    boolean canViewPageContent(long userId, long pageId);
}
