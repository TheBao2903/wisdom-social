/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.dto.request.message.TypingRequest;
import iuh.fit.edu.backend.dto.response.message.TypingResponse;
import iuh.fit.edu.backend.event.payload.TypingEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Controller
@Slf4j
@RequiredArgsConstructor
public class ChatWebSocketController {
    private final ApplicationEventPublisher eventPublisher;

    @MessageMapping("/chat/{conversationId}/typing")
    public void handleTyping(
            @DestinationVariable Long conversationId,
            @Payload TypingRequest request
    ) {
        log.info("Received typing signal: conversationId={}, userId={}, isTyping={}",
                conversationId, request.getUserId(), request.isTyping());

        TypingResponse response = TypingResponse.builder()
                .conversationId(conversationId)
                .userId(request.getUserId())
                .isTyping(request.isTyping())
                .build();

        // Ném vào luồng Event Publisher của hệ thống
        eventPublisher.publishEvent(new TypingEvent(response));
    }
}

