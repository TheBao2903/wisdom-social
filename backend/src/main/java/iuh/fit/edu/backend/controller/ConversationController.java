/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.dto.response.CursorResponse;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import iuh.fit.edu.backend.dto.response.conversation.ConversationResponse;
import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import iuh.fit.edu.backend.service.chat.ConversationMemberService;
import iuh.fit.edu.backend.service.chat.ConversationService;
import iuh.fit.edu.backend.service.chat.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
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

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> getConversationsByUser(@RequestParam Long userId){
        return ResponseEntity.ok(conversationService.getConversationsByUser(userId));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> getConversationById(@PathVariable Long conversationId, @RequestParam Long userId){
        ConversationResponse conversationResponse = conversationService.getConversationById(conversationId, userId);
        return ResponseEntity.ok(conversationResponse);
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<CursorResponse<List<MessageResponse>>> getMessages(
            @PathVariable Long conversationId,
            @RequestParam Long userId,
            @RequestParam(required = false) Instant before,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(
                messageService.getMessagesByConversation(
                        conversationId,
                        userId,
                        before,
                        limit
                )
        );
    }
    @GetMapping("/{conversationId}/messages/newer")
    public ResponseEntity<CursorResponse<List<MessageResponse>>> getNewerMessages(
            @PathVariable Long conversationId,
            @RequestParam Long userId,
            @RequestParam Instant after, // Không để required = false vì thao tác này luôn cần mốc thời gian
            @RequestParam(defaultValue = "20") int limit
    ) {
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
            @PathVariable String targetMessageId,
            @RequestParam Long userId) {

        return ResponseEntity.ok(messageService.jumpToMessage(id, targetMessageId, userId));
    }


    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id, @RequestParam Long userId, @RequestParam(required = false) String lastMessageId){
        conversationService.markAsRead(id,userId, lastMessageId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{conversationId}/delete-for-me")
    public ResponseEntity<Void> deleteConversationForMe(@PathVariable Long conversationId, @RequestParam Long userId){
        this.conversationService.deleteConversationForMe(conversationId, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{conversationId}/members")
    public ResponseEntity<Map<Long, ConversationMemberResponse>> getConversationMembers(
            @PathVariable Long conversationId) {

        Map<Long, ConversationMemberResponse> membersMap = memberService.getMembersMap(conversationId);
        return ResponseEntity.ok(membersMap);
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
