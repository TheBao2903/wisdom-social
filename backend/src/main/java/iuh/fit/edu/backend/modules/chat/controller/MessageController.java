/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import iuh.fit.edu.backend.modules.chat.dto.request.AddReactionRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.ForwardMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.SendCallMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.SendMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.CreatePollRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageRecalledResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.service.MessageService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "*")
public class MessageController {
    private final MessageService messageService;
    private final UserService userService;

    public MessageController(MessageService messageService, UserService userService) {
        this.messageService = messageService;
        this.userService = userService;
    }

    @PostMapping("/send")
    public ResponseEntity<MessageResponse> sendMessage(
            @RequestBody SendMessageRequest sendMessageRequest) {
        Long userId = this.userService.getCurrentUser().getId();
        log.info("User: {}",  userId);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(this.messageService.sendMessage(sendMessageRequest, userId));
    }

    @PostMapping("/polls")
    public ResponseEntity<MessageResponse> createPoll(
            @Valid @RequestBody CreatePollRequest createPollRequest) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(this.messageService.createPoll(createPollRequest, userId));
    }

    @PostMapping("/forward")
    public ResponseEntity<List<MessageResponse>> forwardMessage(
            @Valid @RequestBody ForwardMessageRequest forwardMessageRequest) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(this.messageService.forwardMessage(forwardMessageRequest, userId));
    }

    @PostMapping("/call")
    public ResponseEntity<MessageResponse> sendCallMessage(
            @RequestBody SendCallMessageRequest sendCallMessageRequest) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(this.messageService.sendCallMessage(sendCallMessageRequest, userId));
    }

    @DeleteMapping("/{messageId}/recall")
    public ResponseEntity<MessageRecalledResponse> recallMessage(@PathVariable String messageId) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(this.messageService.recallMessage(messageId, userId));

    }

    @DeleteMapping("/{messageId}/delete-for-me")
    public ResponseEntity<Void> deleteMessageForMe(@PathVariable String messageId) {
        Long userId = this.userService.getCurrentUser().getId();
        this.messageService.deleteMessageForMe(messageId, userId);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @PostMapping("/{messageId}/pin")
    public ResponseEntity<Void> pinMessage(@PathVariable String messageId) {
        Long userId = this.userService.getCurrentUser().getId();
        this.messageService.pinMessage(messageId, userId);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @DeleteMapping("/{messageId}/pin")
    public ResponseEntity<Void> unpinMessage(@PathVariable String messageId) {
        Long userId = this.userService.getCurrentUser().getId();
        this.messageService.unpinMessage(messageId, userId);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @PostMapping("/{messageId}/reactions")
    public ResponseEntity<MessageResponse> addReaction(
            @PathVariable String messageId,
            @Valid @RequestBody AddReactionRequest request) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(this.messageService.addReaction(messageId, userId, request.getEmoji()));
    }

    @GetMapping("/{messageId}")
    public ResponseEntity<MessageResponse> getMessage(@PathVariable String messageId) {
        Long userId = this.userService.getCurrentUser().getId();
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(this.messageService.getMessageById(messageId, userId));
    }

}
