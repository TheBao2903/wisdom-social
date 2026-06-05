package iuh.fit.edu.backend.modules.post.event.publisher;

import iuh.fit.edu.backend.common.config.RedisPubSubConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import iuh.fit.edu.backend.modules.post.event.payload.ReactionEvent;
import iuh.fit.edu.backend.common.event.payload.RedisEnvelope;
import iuh.fit.edu.backend.common.event.type.DomainEventType;

import java.util.Collections;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReactionEventPublisher {

    @Qualifier("pubSubRedisTemplate")
    private final RedisTemplate<String, Object> pubSubRedisTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleReactionRealtimeEvent(ReactionEvent event) {
        log.info("📡 Publishing ReactionRealtimeEvent to Redis for post: {}", event.getRootPostId());

        try {
            RedisEnvelope envelope = new RedisEnvelope(
                    Collections.emptySet(),
                    DomainEventType.REACTION,
                    event
            );

            pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.REACT_CHANNEL, envelope);
            log.info("✅ Successfully published reaction event to Redis channel: {}", RedisPubSubConfig.REACT_CHANNEL);
        } catch (Exception e) {
            log.error("❌ Error publishing reaction event to Redis", e);
        }
    }
}
