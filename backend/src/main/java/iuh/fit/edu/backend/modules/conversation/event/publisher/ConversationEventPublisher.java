/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.publisher;

import iuh.fit.edu.backend.common.config.RedisPubSubConfig;
import iuh.fit.edu.backend.common.event.payload.RedisEnvelope;
import iuh.fit.edu.backend.modules.conversation.event.payload.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
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

    // Hàm xử lý gửi sự kiện tạo nhóm cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleConversationCreated(ConversationCreatedEvent event){
        log.info("Publishing create conversation to redis pub/sub for {} member", event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi cập nhật side bar cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleConversationUpdated(ConversationUpdatedEvent event){
        log.info("Publishing update conversation to redis pub/sub for {} members",  event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi sự kiện tạo yêu cầu tham gia cho redis pub/sub
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleNewJoinRequest(NewJoinRequestEvent event){
        log.info("Publishing new join request to redis pub/sub for {} member", event.getNotifyAdminIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getNotifyAdminIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleJoinRequestProcessed(JoinRequestProcessedEvent event){
        log.info("Publishing join request response to redis pub/sub for {} member", event.getNotifyAdminIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getNotifyAdminIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi sự kiện thêm thành viên cho redis pub/sub
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleBlockedMembersUpdated(BlockedMembersUpdatedEvent event){
        log.info("Publishing blocked members update to redis pub/sub for {} admins", event.getNotifyAdminIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getNotifyAdminIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleDirectBlockStatusChanged(DirectBlockStatusChangedEvent event) {
        log.info("Publishing direct block status update to redis pub/sub for {} members", event.getRecipientUserIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getRecipientUserIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMemberAdded(MemberAddedEvent event){
        log.info("Publishing add member to redis pub/sub for {} member", event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    // Hàm xử lý gửi sự kiên remove hoặc kick member cho redis pub/sub
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMemberStatusChanged(MemberStatusChangedEvent event){
        log.info("Publishing update status member to redis pub/sub for {} member", event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMemberRoleUpdated(MemberRoleUpdatedEvent event){
        log.info("Publishing update role member to redis pub/sub for {} member", event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleGroupDisbanded(GroupDisbandedEvent event){
        log.info("Publishing disband group to redis pub/sub for {} member", event.getMemberIds());
        RedisEnvelope envelope = new RedisEnvelope(
                event.getMemberIds(),
                event.getDomainEventType(),
                event
        );
        redisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
    }




}
