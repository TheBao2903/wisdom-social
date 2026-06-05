package iuh.fit.edu.backend.modules.post.event.publisher;

import iuh.fit.edu.backend.common.config.RedisPubSubConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import iuh.fit.edu.backend.modules.post.event.payload.CommentEvent;
import iuh.fit.edu.backend.common.event.payload.RedisEnvelope;
import iuh.fit.edu.backend.common.event.type.DomainEventType;

import java.util.Collections;

@Component
@RequiredArgsConstructor
@Slf4j
public class CommentEventPublisher {

    @Qualifier("pubSubRedisTemplate")
    private final RedisTemplate<String, Object> pubSubRedisTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleCommentRealtimeEvent(CommentEvent event) {
        log.info("📡 Publishing CommentRealtimeEvent to Redis for post: {}", event.getPostId());

        try {
            RedisEnvelope envelope = new RedisEnvelope(
                    Collections.emptySet(),
                    DomainEventType.COMMENT,
                    event
            );
            // No targetMemberIds required because we broadcast to everyone on this postId

            pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.COMMENT_CHANNEL, envelope);
            log.info("✅ Successfully published comment event to Redis channel: {}", RedisPubSubConfig.COMMENT_CHANNEL);
        } catch (Exception e) {
            log.error("❌ Error publishing comment event to Redis", e);
        }
    }
}
