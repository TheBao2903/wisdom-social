package iuh.fit.edu.backend.modules.page.event.publisher;

import iuh.fit.edu.backend.common.config.RedisPubSubConfig;
import iuh.fit.edu.backend.modules.page.event.payload.PageEvent;
import iuh.fit.edu.backend.modules.page.event.payload.PageListEvent;
import iuh.fit.edu.backend.modules.page.event.payload.PagePostEvent;
import iuh.fit.edu.backend.common.event.payload.RedisEnvelope;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collections;

/**
 * Broadcasts real-time page events via Redis Pub/Sub.
 * Covers: member events, post events, page list events.
 */
@Component
@Slf4j
public class PageEventPublisher {

    private final RedisTemplate<String, Object> pubSubRedisTemplate;

    public PageEventPublisher(@Qualifier("pubSubRedisTemplate") RedisTemplate<String, Object> pubSubRedisTemplate) {
        this.pubSubRedisTemplate = pubSubRedisTemplate;
    }

    // ── Member Events ─────────────────────────────────────────────────────

    private void publishToRedis(DomainEventType type, long pageId, long userId, String newRole, boolean sendToPage, boolean sendToUser) {
        PageEvent event = PageEvent.builder()
                .eventType(type)
                .pageId(pageId)
                .userId(userId)
                .newRole(newRole)
                .timestamp(Instant.now().toString())
                .sendToPage(sendToPage)
                .sendToUser(sendToUser)
                .build();

        RedisEnvelope envelope = new RedisEnvelope(
                Collections.emptySet(),
                type,
                event
        );

        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
        log.info("Published {} to Redis for Page {} and User {}", type, pageId, userId);
    }

    public void publishMemberJoined(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_MEMBER_JOINED, pageId, userId, null, true, false);
    }

    public void publishMemberLeft(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_MEMBER_LEFT, pageId, userId, null, true, false);
    }

    public void publishMemberBlocked(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_MEMBER_BLOCKED, pageId, userId, null, true, true);
    }

    public void publishMemberUnblocked(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_MEMBER_UNBLOCKED, pageId, userId, null, true, true);
    }

    public void publishMemberRoleChanged(long pageId, long userId, String newRole) {
        publishToRedis(DomainEventType.PAGE_MEMBER_ROLE_CHANGED, pageId, userId, newRole, true, true);
    }

    public void publishJoinRequested(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_JOIN_REQUESTED, pageId, userId, null, true, false);
    }

    public void publishJoinApproved(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_JOIN_APPROVED, pageId, userId, null, true, true);
    }

    public void publishJoinRejected(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_JOIN_REJECTED, pageId, userId, null, false, true);
    }

    public void publishJoinCancelled(long pageId, long userId) {
        publishToRedis(DomainEventType.PAGE_JOIN_CANCELLED, pageId, userId, null, true, false);
    }

    // ── Page Post Events ──────────────────────────────────────────────────

    private void publishPostEvent(DomainEventType type, long pageId, String postId, long userId, Object post) {
        PagePostEvent event = PagePostEvent.builder()
                .eventType(type)
                .pageId(pageId)
                .postId(postId)
                .userId(userId)
                .post(post)
                .timestamp(Instant.now().toString())
                .build();

        RedisEnvelope envelope = new RedisEnvelope(Collections.emptySet(), type, event);
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
        log.info("Published {} to Redis for Page {} Post {}", type, pageId, postId);
    }

    public void publishPostSubmitted(long pageId, String postId, long userId, Object post) {
        publishPostEvent(DomainEventType.PAGE_POST_SUBMITTED, pageId, postId, userId, post);
    }

    public void publishPostApproved(long pageId, String postId, long userId, Object post) {
        publishPostEvent(DomainEventType.PAGE_POST_APPROVED, pageId, postId, userId, post);
    }

    public void publishPostRejected(long pageId, String postId, long userId) {
        publishPostEvent(DomainEventType.PAGE_POST_REJECTED, pageId, postId, userId, null);
    }

    public void publishPostRemoved(long pageId, String postId, long userId) {
        publishPostEvent(DomainEventType.PAGE_POST_REMOVED, pageId, postId, userId, null);
    }

    // ── Page List Events ──────────────────────────────────────────────────

    private void publishPageListEvent(DomainEventType type, long pageId, Object page) {
        PageListEvent event = PageListEvent.builder()
                .eventType(type)
                .pageId(pageId)
                .page(page)
                .timestamp(Instant.now().toString())
                .build();

        RedisEnvelope envelope = new RedisEnvelope(Collections.emptySet(), type, event);
        pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.CHAT_CHANNEL, envelope);
        log.info("Published {} to Redis for Page {}", type, pageId);
    }

    public void publishPageCreated(long pageId, Object page) {
        publishPageListEvent(DomainEventType.PAGE_CREATED, pageId, page);
    }

    public void publishPageUpdated(long pageId, Object page) {
        publishPageListEvent(DomainEventType.PAGE_UPDATED, pageId, page);
    }

    public void publishPageDeleted(long pageId) {
        publishPageListEvent(DomainEventType.PAGE_DELETED, pageId, null);
    }
}
