package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.constant.MemberStatus;
import iuh.fit.edu.backend.domain.entity.mysql.PageMember;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.page.PageJoinRequest;
import iuh.fit.edu.backend.dto.request.page.UserRequestAuthorizePage;
import iuh.fit.edu.backend.dto.request.page.UserRequestMemberPage;
import iuh.fit.edu.backend.dto.request.page.UserRequestPage;
import iuh.fit.edu.backend.service.page.PageMemberService;
import iuh.fit.edu.backend.service.user.UserService;
import iuh.fit.edu.backend.util.anotation.ApiMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/page-member")
public class PageMemberController {
    UserService userService;
    PageMemberService pageMemberService;


    public PageMemberController(PageMemberService pageMemberService, UserService userService) {
        this.pageMemberService = pageMemberService;
        this.userService = userService;
    }

    @PostMapping("/add")
    @ApiMessage("Add member into page successfully")
    public ResponseEntity<String> addMemberPage(@RequestBody UserRequestMemberPage userRequestMemberPage){
        boolean success=pageMemberService.addMemberPage(userRequestMemberPage);
        if (success)
            return ResponseEntity.ok("Add member into page successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Add member into page failed");
    }

    @PostMapping("/delete")
    @ApiMessage("Delete member into page successfully")
    public ResponseEntity<String> deleteMemberPage(@RequestBody UserRequestPage requestPage){
        boolean success=pageMemberService.deleteMemberPage(requestPage.getPageId(),requestPage.getUserId());
        if (success)
            return ResponseEntity.ok("Delete member into page successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Delete member in page failed");
    }

    @PostMapping("/block")
    @ApiMessage("Block member into page successfully")
    public ResponseEntity<String> blockMemberPage(@RequestBody UserRequestPage requestPage){
        boolean success=pageMemberService.blockMemberPage(requestPage.getPageId(),requestPage.getUserId());
        if (success)
            return ResponseEntity.ok("Block member into page successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Block member in page failed");
    }

    @PostMapping("/cancel-block")
    @ApiMessage("Cancel block member into page successfully")
    public ResponseEntity<String> cancelBlockMemberPage(@RequestBody UserRequestPage requestPage){
        boolean success=pageMemberService.cancelBlockMemberPage(requestPage.getPageId(),requestPage.getUserId());
        if (success)
            return ResponseEntity.ok("Cancel block member into page successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Cancel block member in page failed");
    }

    @PostMapping("/authorize")
    @ApiMessage("Authorize member into page successfully")
    public ResponseEntity<String> authorizeMemberPage(@RequestBody UserRequestAuthorizePage requestPage){
        pageMemberService.authorizeMemberPage(requestPage.getUserId(), requestPage.getPageId(), requestPage.getPageRole());
            return ResponseEntity.ok("Authorize member into page successfully");
    }

    @GetMapping("/list/{pageId}")
    @ApiMessage("Get page members successfully")
    public ResponseEntity<List<PageMember>> getPageMembers(@PathVariable long pageId){
        List<PageMember> members = pageMemberService.getMembersByPageId(pageId);
        return ResponseEntity.ok(members);
    }

    // New endpoints for join request feature
    @PostMapping("/request-join")
    @ApiMessage("Join request sent successfully")
    public ResponseEntity<String> requestJoinPage(@RequestBody PageJoinRequest request){
        boolean success = pageMemberService.requestJoinPage(request);
        if (success)
            return ResponseEntity.ok("Join request sent successfully");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Join request failed");
    }

    @PostMapping("/approve-join")
    @ApiMessage("Join request approved successfully")
    public ResponseEntity<String> approveJoinRequest(@RequestBody UserRequestPage request){
        User user=userService.getCurrentUser();
        boolean success = pageMemberService.approveJoinRequest(request.getPageId(), request.getUserId(), user.getId());
        if (success)
            return ResponseEntity.ok("Join request approved successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Join request approval failed");
    }

    @PostMapping("/reject-join")
    @ApiMessage("Join request rejected")
    public ResponseEntity<String> rejectJoinRequest(@RequestBody UserRequestPage request){
        User user=userService.getCurrentUser();
        boolean success = pageMemberService.rejectJoinRequest(request.getPageId(), request.getUserId(), user.getId());
        if (success)
            return ResponseEntity.ok("Join request rejected successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Join request rejection failed");
    }

    @GetMapping("/pending-requests/{pageId}")
    @ApiMessage("Get pending join requests successfully")
    public ResponseEntity<List<PageMember>> getPendingJoinRequests(@PathVariable long pageId){
        List<PageMember> pendingRequests = pageMemberService.getPendingJoinRequests(pageId);
        return ResponseEntity.ok(pendingRequests);
    }

    @GetMapping("/member-status/{pageId}/{userId}")
    @ApiMessage("Get member status successfully")
    public ResponseEntity<MemberStatus> getMemberStatus(@PathVariable long pageId, @PathVariable long userId){
        MemberStatus status = pageMemberService.getMemberStatus(pageId, userId);
        return ResponseEntity.ok(status);
    }

    @PostMapping("/cancel-join")
    @ApiMessage("Join request cancelled successfully")
    public ResponseEntity<String> cancelJoinRequest(@RequestBody UserRequestPage request){
        boolean success = pageMemberService.cancelJoinRequest(request.getPageId(), request.getUserId());
        if (success)
            return ResponseEntity.ok("Join request cancelled successfully");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Cancel join request failed");
    }

    @GetMapping("/member-count/{pageId}")
    @ApiMessage("Get member count successfully")
    public ResponseEntity<Long> getMemberCount(@PathVariable long pageId){
        long count = pageMemberService.countActiveMembers(pageId);
        return ResponseEntity.ok(count);
    }
}
