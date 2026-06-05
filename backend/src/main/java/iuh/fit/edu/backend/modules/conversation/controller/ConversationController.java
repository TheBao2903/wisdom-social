/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.controller;

import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberWithInvitesRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.CreateGroupRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.CreateGroupWithInvitesRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.ResolveDirectConversationRequest;
import iuh.fit.edu.backend.modules.conversation.dto.request.UpdateGroupImageRequest;
import iuh.fit.edu.backend.common.dto.response.CursorResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationPreviewResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationSidebarResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageSearchResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.ConversationMediaResponse;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import iuh.fit.edu.backend.modules.conversation.service.ConversationService;
import iuh.fit.edu.backend.modules.conversation.service.DirectConversationService;
import iuh.fit.edu.backend.modules.chat.service.MessageService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final ConversationMemberService memberService;
    private final UserService userService;
    private final DirectConversationService directConversationService;

    @GetMapping
    public ResponseEntity<List<ConversationSidebarResponse>> getConversationsByUser(){
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.getConversationsByUser(userId));
    }

    @GetMapping("/forward-targets")
    public ResponseEntity<List<ConversationSidebarResponse>> getForwardableConversationsByUser(){
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.getForwardableConversationsByUser(userId));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> getConversationById(@PathVariable Long conversationId){
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse conversationResponse = conversationService.getConversationById(conversationId, userId);
        return ResponseEntity.ok(conversationResponse);
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<CursorResponse<List<MessageResponse>>> getMessages(
            @PathVariable Long conversationId,
            @RequestParam(required = false) Instant before,
            @RequestParam(defaultValue = "20") int limit
    ) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(
                messageService.getMessagesByConversation(
                        conversationId,
                        userId,
                        before,
                        limit
                )
        );
    }

    @GetMapping("/{conversationId}/messages/search")
    public ResponseEntity<MessageSearchResponse> searchMessages(
            @PathVariable Long conversationId,
            @RequestParam String keyword,
            @RequestParam(required = false) Long senderId,
            @RequestParam(required = false) Instant fromDate,
            @RequestParam(required = false) Instant toDate,
            @RequestParam(required = false) Instant cursor,
            @RequestParam(defaultValue = "5") int limit
    ) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(
                messageService.searchMessages(conversationId, userId, keyword, senderId, fromDate, toDate, cursor, limit)
        );
    }

    @GetMapping("/{conversationId}/messages/media")
    public ResponseEntity<ConversationMediaResponse> getConversationMedia(
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "MEDIA") String type,
            @RequestParam(required = false) Instant cursor,
            @RequestParam(defaultValue = "20") int limit
    ) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(
                messageService.getConversationMedia(conversationId, userId, type, cursor, limit)
        );
    }

    @GetMapping("/{conversationId}/messages/newer")
    public ResponseEntity<CursorResponse<List<MessageResponse>>> getNewerMessages(
            @PathVariable Long conversationId,
            @RequestParam Instant after, // Không để required = false vì thao tác này luôn cần mốc thời gian
            @RequestParam(defaultValue = "20") int limit
    ) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(
                messageService.getNewerMessages(
                        conversationId,
                        userId,
                        after,
                        limit
                )
        );
    }
    @GetMapping("/{id}/messages/{targetMessageId}/jump")
    public ResponseEntity<CursorResponse<List<MessageResponse>>> jumpToMessage(
            @PathVariable Long id,
            @PathVariable String targetMessageId) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(messageService.jumpToMessage(id, targetMessageId, userId));
    }


    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id, @RequestParam(required = false) String lastMessageId){
        Long userId = this.userService.getCurrentUser().getId();
        conversationService.markAsRead(id,userId, lastMessageId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{conversationId}/delete-for-me")
    public ResponseEntity<Void> deleteConversationForMe(@PathVariable Long conversationId){
        Long userId = this.userService.getCurrentUser().getId();
        this.conversationService.deleteConversationForMe(conversationId, userId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{conversationId}/hide-for-me")
    public ResponseEntity<Void> hideConversationForMe(@PathVariable Long conversationId){
        Long userId = this.userService.getCurrentUser().getId();
        this.conversationService.hideConversationForMe(conversationId, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{conversationId}/members")
    public ResponseEntity<Map<Long, ConversationMemberResponse>> getConversationMembers(
            @PathVariable Long conversationId) {
        Map<Long, ConversationMemberResponse> membersMap = memberService.getMembersMap(conversationId);
        return ResponseEntity.ok(membersMap);
    }

    @PostMapping("/group")
    public ResponseEntity<ConversationResponse> createConversation(@Valid @RequestBody CreateGroupRequest request){
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse response = this.conversationService.createGroup(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/group-with-invites")
    public ResponseEntity<ConversationResponse> createConversationWithInvites(
            @Valid @RequestBody CreateGroupWithInvitesRequest request) {
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse response = this.conversationService.createGroupWithInvites(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/direct/resolve")
    public ResponseEntity<ConversationResponse> resolveDirectConversation(
            @Valid @RequestBody ResolveDirectConversationRequest request) {
        Long userId = this.userService.getCurrentUser().getId();
        Long conversationId = directConversationService
                .getOrCreateDirectConversation(userId, request.getReceiverId())
                .conversation()
                .getId();
        return ResponseEntity.ok(conversationService.getConversationById(conversationId, userId));
    }
    @PostMapping("/{conversationId}/members")
    public ResponseEntity<ConversationResponse> addMembers(@PathVariable Long conversationId, @Valid @RequestBody AddMemberRequest request){
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse response = this.memberService.addMembers(conversationId, request, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{conversationId}/members-with-invites")
    public ResponseEntity<ConversationResponse> addMembersWithInvites(
            @PathVariable Long conversationId,
            @Valid @RequestBody AddMemberWithInvitesRequest request) {
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse response = this.memberService.addMembersWithInvites(conversationId, request, userId);
        return ResponseEntity.ok(response);
    }
    @DeleteMapping("/{conversationId}/leave")
    public ResponseEntity<ConversationResponse> leaveGroup(
            @PathVariable Long conversationId) {
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse response = memberService.leaveGroup(conversationId, userId);
        return ResponseEntity.ok(response);
    }

    // API 2: Đuổi thành viên khác
    @DeleteMapping("/{conversationId}/members/{targetId}")
    public ResponseEntity<ConversationResponse> kickMember(
            @PathVariable Long conversationId,
            @PathVariable Long targetId) {
        Long requesterId = this.userService.getCurrentUser().getId();
        ConversationResponse response = memberService.kickMember(conversationId, targetId, requesterId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{conversationId}/blocked-members")
    public ResponseEntity<List<ConversationMemberResponse>> getBlockedMembers(@PathVariable Long conversationId) {
        Long requesterId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(memberService.getBlockedMembers(conversationId, requesterId));
    }

    @PostMapping("/{conversationId}/blocked-members/{targetId}")
    public ResponseEntity<ConversationResponse> blockMember(
            @PathVariable Long conversationId,
            @PathVariable Long targetId) {
        Long requesterId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(memberService.blockMember(conversationId, targetId, requesterId));
    }

    @DeleteMapping("/{conversationId}/blocked-members/{targetId}")
    public ResponseEntity<ConversationResponse> unblockMember(
            @PathVariable Long conversationId,
            @PathVariable Long targetId) {
        Long requesterId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(memberService.unblockMember(conversationId, targetId, requesterId));
    }

    @PatchMapping("/{conversationId}/members/{targetId}/role")
    public ResponseEntity<ConversationResponse> updateMemberRole(
            @PathVariable Long conversationId,
            @PathVariable Long targetId,
            MemberRole newRole) { // Phải là ID của OWNER
        Long requesterId = this.userService.getCurrentUser().getId();
        ConversationResponse response = memberService.updateMemberRole(
                conversationId, targetId, requesterId, newRole
        );
        return ResponseEntity.ok(response);
    }
    @DeleteMapping("/{conversationId}/disband")
    public ResponseEntity<Void> disbandGroup(
            @PathVariable Long conversationId) {

        Long userId = this.userService.getCurrentUser().getId();
        memberService.disbandGroup(conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("{conversationId}/settings/message-restriction")
    public ResponseEntity<ConversationResponse> updateMessageRestriction(@PathVariable Long conversationId, @RequestParam boolean isRestricted){
        Long userId = this.userService.getCurrentUser().getId();
        ConversationResponse response = this.conversationService.updateMessageRestriction(conversationId, userId, isRestricted);
        return ResponseEntity.ok(response);
    }
    @PatchMapping("/{conversationId}/settings/join-approval")
    public ResponseEntity<ConversationResponse> updateJoinApprovalSetting(
            @PathVariable Long conversationId,
            @RequestParam boolean isRequired) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.updateJoinApprovalRequired(conversationId, userId, isRequired));
    }

    @PatchMapping("/{conversationId}/image")
    public ResponseEntity<ConversationResponse> updateGroupImage(
            @PathVariable Long conversationId,
            @Valid @RequestBody UpdateGroupImageRequest request) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.updateGroupImage(conversationId, userId, request.getImageUrl()));
    }

    @GetMapping("/{conversationId}/invite-link")
    public ResponseEntity<String> getInviteLink(
            @PathVariable Long conversationId) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.getOrGenerateInviteLink(conversationId, userId));
    }

    @PatchMapping("/{conversationId}/invite-link/reset")
    public ResponseEntity<String> resetInviteLink(
            @PathVariable Long conversationId) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.resetInviteLink(conversationId, userId));
    }

    @DeleteMapping("/{conversationId}/invite-link")
    public ResponseEntity<Void> disableInviteLink(
            @PathVariable Long conversationId) {
        Long userId = this.userService.getCurrentUser().getId();
        conversationService.disableInviteLink(conversationId, userId);
        return ResponseEntity.noContent().build();
    }


    @GetMapping("/invite/{token}")
    public ResponseEntity<ConversationPreviewResponse> previewGroup(
            @PathVariable String token) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.previewGroupFromToken(token, userId));
    }

    @PostMapping("/invite/{token}/join")
    public ResponseEntity<?> joinGroupByToken(
            @PathVariable String token,
            @RequestParam(required = false) String message) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity.ok(conversationService.joinGroupFromToken(token, userId, message));
    }


    @PatchMapping("/{conversationId}/members/{targetUserId}/nickname")
    public ResponseEntity<String> updateNickname(
            @PathVariable Long conversationId,
            @PathVariable Long targetUserId,
            @RequestBody String nickname) {
        memberService.updateNickname(conversationId, targetUserId, nickname);
        return ResponseEntity.ok("Cập nhật biệt danh thành công");
    }


}
