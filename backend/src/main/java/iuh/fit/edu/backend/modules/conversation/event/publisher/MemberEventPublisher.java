/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.publisher;

import iuh.fit.edu.backend.common.config.RedisPubSubConfig;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberUpdatedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberAccountLockChangedEvent;
import iuh.fit.edu.backend.common.event.payload.RedisEnvelope;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
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

    // Đẩy sự kiện khóa/mở khóa tài khoản của 1 thành viên xuống Redis pub/sub.
    // targetMemberIds = các thành viên khác cần cập nhật sidebar (fan-out theo user).
    @EventListener
    public void handleMemberAccountLockChangedEvent(MemberAccountLockChangedEvent event) {
        log.info("Publishing account lock change of member {} (locked={}) to redis for conversation {}",
                event.getUserId(), event.isAccountLocked(), event.getConversationId());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getRecipientUserIds() != null
                        ? event.getRecipientUserIds()
                        : Collections.emptySet(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }
}
