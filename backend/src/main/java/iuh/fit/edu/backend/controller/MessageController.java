/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.dto.request.message.SendMessageRequest;
import iuh.fit.edu.backend.dto.request.SendCallMessageRequest;
import iuh.fit.edu.backend.dto.response.CursorResponse;
import iuh.fit.edu.backend.dto.response.message.MessageRecalledResponse;
import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import iuh.fit.edu.backend.service.chat.MessageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "*")
public class MessageController {
    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping("/send")
    public ResponseEntity<MessageResponse> sendMessage(
            @RequestBody SendMessageRequest sendMessageRequest,
            @RequestParam Long userId) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(this.messageService.sendMessage(sendMessageRequest, userId));
    }

    @PostMapping("/call")
    public ResponseEntity<MessageResponse> sendCallMessage(
            @RequestBody SendCallMessageRequest sendCallMessageRequest,
            @RequestParam Long userId) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(this.messageService.sendCallMessage(sendCallMessageRequest, userId));
    }

    @DeleteMapping("/{messageId}/recall")
    public ResponseEntity<MessageRecalledResponse> recallMessage(@PathVariable String messageId,
            @RequestParam Long userId) {
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(this.messageService.recallMessage(messageId, userId));

    }
    @DeleteMapping("/{messageId}/delete-for-me")
    public ResponseEntity<Void> deleteMessageForMe(@PathVariable String messageId, @RequestParam Long userId){
        this.messageService.deleteMessageForMe(messageId, userId);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @PostMapping("/{messageId}/pin")
    public ResponseEntity<Void> pinMessage(
            @PathVariable String messageId,
            @RequestParam Long userId
    ) {
        this.messageService.pinMessage(messageId, userId);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @DeleteMapping("/{messageId}/pin")
    public ResponseEntity<Void> unpinMessage(
            @PathVariable String messageId,
            @RequestParam Long userId
    ) {
        this.messageService.unpinMessage(messageId, userId);
        return ResponseEntity.status(HttpStatus.OK).build();
    }


}
