/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.publisher;

import iuh.fit.edu.backend.config.RedisPubSubConfig;
import iuh.fit.edu.backend.event.payload.ConversationUpdatedEvent;
import iuh.fit.edu.backend.event.payload.RedisEnvelope;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Component
@Slf4j

public class ConversationEventPublisher {
    private final RedisTemplate<String, Object> redisTemplate;

    public ConversationEventPublisher(@Qualifier("pubSubRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }


    // Hàm xử lý gửi cập nhật side bar cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMessageCreated(ConversationUpdatedEvent event){
        log.info("Publishing update conversation to redis pub/sub for {} members",  event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }
}
