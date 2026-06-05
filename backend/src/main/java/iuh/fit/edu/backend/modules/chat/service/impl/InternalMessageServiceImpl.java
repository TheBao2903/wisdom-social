/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service.impl;

import iuh.fit.edu.backend.common.util.TransactionUtil;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.chat.entity.Message;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.event.payload.MessageCreatedEvent;
import iuh.fit.edu.backend.modules.chat.mapper.MessageMapper;
import iuh.fit.edu.backend.modules.chat.repository.MessageRepository;
import iuh.fit.edu.backend.modules.chat.service.InternalMessageService;
import iuh.fit.edu.backend.modules.chat.service.MessageCacheService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Service
@AllArgsConstructor
public class InternalMessageServiceImpl implements InternalMessageService {
    private final MessageRepository messageRepository;
    private final MessageCacheService messageCacheService;
    private final MessageMapper messageMapper;
    private final ApplicationEventPublisher eventPublisher;
    @Override
    public void createSystemMessage(Long conversationId, Long actorId, MessageType type, String content) {
        Message systemMsg = new Message();
        systemMsg.setConversationId(conversationId);
        systemMsg.setSenderId(actorId);
        systemMsg.setMessageType(type);
        systemMsg.setContent(content);
        systemMsg.setCreatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        Message savedMsg = messageRepository.save(systemMsg);

        // Map ra DTO và Bắn Socket KHUNG CHAT (Giống hệt hàm sendMessage bình thường)
        MessageResponse msgResponse = messageMapper.toMessageResponse(savedMsg);
        TransactionUtil.executeAfterCommit(() -> {
            messageCacheService.cacheNewMessage(msgResponse);
        });

        this.eventPublisher.publishEvent(new MessageCreatedEvent(msgResponse));
    }
}
