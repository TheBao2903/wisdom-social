package iuh.fit.edu.backend.service.page;

import iuh.fit.edu.backend.constant.MemberStatus;
import iuh.fit.edu.backend.constant.PageRole;
import iuh.fit.edu.backend.domain.entity.mysql.PageMember;
import iuh.fit.edu.backend.dto.request.page.PageJoinRequest;
import iuh.fit.edu.backend.dto.request.page.UserRequestMemberPage;

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
}
