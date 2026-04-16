/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.publisher;

import iuh.fit.edu.backend.config.RedisPubSubConfig;
import iuh.fit.edu.backend.dto.response.message.MessageRecalledResponse;
import iuh.fit.edu.backend.event.payload.*;
import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Collections;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Component
@Slf4j
public class ChatEventPublisher {
    private final RedisTemplate<String, Object> pubSubRedisTemplate;

    public ChatEventPublisher(@Qualifier("pubSubRedisTemplate") RedisTemplate<String, Object> pubSubRedisTemplate) {
        this.pubSubRedisTemplate = pubSubRedisTemplate;
    }


    // Hàm xử lý gửi sự kiện gửi tin nhắn cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMessageCreated(MessageCreatedEvent event){
        log.info("Publishing new message to redis pub/sub for conversation: {}", event.getMessageResponse().getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                Collections.emptySet(),
                event.getDomainEventType(),
                event
        );
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi sự kiện thu hồi tin nhắn cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMessageRecalled(MessageRecalledEvent event){

        log.info("Publishing recall message to redis pub/sub for conversation: {}", event.getMessageRecalledResponse().getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                Collections.emptySet(),
                event.getDomainEventType(),
                event
        );
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi sự kiện xem tin nhắn cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMessageSeenEvent(MessageSeenEvent event) {
        log.info("Publishing seen message to redis pub/sub for conversation: {}", event.getMessageSeenResponse().getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getReceiverIds(),
                event.getDomainEventType(),
                event
        );
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }
    // Hàm xử lý gửi sự kiện ghim tin nhắn cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handlePinUpdatedEvent(PinUpdatedEvent event) {
        log.info("Publishing pin message to redis pub/sub for conversation: {}", event.getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                Collections.emptySet(),
                event.getDomainEventType(),
                event
        );
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi sự kiện đang gõ tin nhắn cho redis pub/sub
    @EventListener
    public void handleTypingEvent(TypingEvent event) {
        log.info("Publishing typing message to redis pub/sub for conversation: {}", event.getTypingResponse().getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                Collections.emptySet(),
                event.getDomainEventType(),
                event
        );
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
        Long conversationId = event.getTypingResponse().getConversationId();
    }


    @EventListener
    public void handleUserStatusEvent(UserStatusEvent event) {
        log.info("Publishing user status to redis pub/sub");
//        RedisEnvelope envelope = new RedisEnvelope(
//                Collections.emptySet(),
//                event.getDomainEventType(),
//                event
//        );
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, event);
    }


}
