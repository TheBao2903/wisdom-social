package iuh.fit.edu.backend.modules.conversation.controller;

import iuh.fit.edu.backend.modules.conversation.dto.response.JoinRequestResponse;
import iuh.fit.edu.backend.modules.conversation.service.GroupJoinRequestService;
import iuh.fit.edu.backend.modules.conversation.service.impl.GroupApprovalOrchestrator;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations/{conversationId}/join-requests")
@RequiredArgsConstructor
public class GroupJoinRequestController {

    private final GroupJoinRequestService joinRequestService;
    private final GroupApprovalOrchestrator approvalOrchestrator;
    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<JoinRequestResponse>> getPendingRequests(
            @PathVariable Long conversationId) {
        Long userId = userService.getCurrentUser().getId();
        return ResponseEntity.ok(joinRequestService.getPendingRequests(conversationId, userId));
    }

    @PostMapping
    public ResponseEntity<?> createJoinRequest(
            @PathVariable Long conversationId) {
        Long userId = userService.getCurrentUser().getId();
        joinRequestService.createRequest(conversationId, userId, null);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> cancelMyJoinRequest(
            @PathVariable Long conversationId) {
        Long userId = userService.getCurrentUser().getId();
        joinRequestService.cancelMyPendingRequest(conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{requestId}")
    public ResponseEntity<?> processJoinRequest(
            @PathVariable Long conversationId,
            @PathVariable Long requestId,
            @RequestParam boolean isApproved) {
        Long userId = userService.getCurrentUser().getId();
        approvalOrchestrator.executeApprovalFlow(requestId, userId, isApproved);
        return ResponseEntity.ok().build();
    }
}
