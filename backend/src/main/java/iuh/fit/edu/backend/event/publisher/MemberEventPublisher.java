/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.publisher;

import iuh.fit.edu.backend.config.RedisPubSubConfig;
import iuh.fit.edu.backend.event.payload.MemberUpdatedEvent;
import iuh.fit.edu.backend.event.payload.RedisEnvelope;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Collections;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Component
public class MemberEventPublisher {

    private final RedisTemplate<String, Object> redisTemplate;

    public MemberEventPublisher(@Qualifier("pubSubRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // Hàm xử lý gửi thông tin cập nhật cho redis pub/sub
    @EventListener
    public void handleMemberUpdatedEvent(MemberUpdatedEvent event) {
        log.info("Publishing update member {} to redis pub/sub for conversation {}",  event.getUserId(), event.getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                Collections.emptySet(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }
}
