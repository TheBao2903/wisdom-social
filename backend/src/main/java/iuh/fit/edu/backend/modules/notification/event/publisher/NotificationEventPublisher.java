package iuh.fit.edu.backend.modules.notification.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.common.config.RedisPubSubConfig;
import iuh.fit.edu.backend.modules.notification.entity.mongodb.Notification;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.notification.repository.NotificationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.Set;
import java.util.Collections;

import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.common.event.payload.RedisEnvelope;
import iuh.fit.edu.backend.common.event.type.DomainEventType;

import iuh.fit.edu.backend.modules.user.service.UserService;
import iuh.fit.edu.backend.modules.notification.entity.mongodb.NotificationMetadata;
import iuh.fit.edu.backend.modules.user.entity.User;

@Component
@Slf4j
public class NotificationEventPublisher {

    private final NotificationRepository notificationRepository;
    private final UserService userService;
    private final RedisTemplate<String, Object> pubSubRedisTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public NotificationEventPublisher(
            NotificationRepository notificationRepository,
            UserService userService,
            @Qualifier("pubSubRedisTemplate") RedisTemplate<String, Object> pubSubRedisTemplate,
            StringRedisTemplate stringRedisTemplate,
            @Qualifier("pubSubObjectMapper") ObjectMapper objectMapper) {
        this.notificationRepository = notificationRepository;
        this.userService = userService;
        this.pubSubRedisTemplate = pubSubRedisTemplate;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
    }

    private static final String UNREAD_COUNT_KEY = "notification:unread:%s";
    private static final String RECENT_NOTIFICATIONS_KEY = "notification:recent:%s";
    private static final int MAX_RECENT_NOTIFICATIONS = 50;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    // @Async - Temporarily disabled to debug sync issues
    public void handleNotificationEvent(NotificationEvent event) {
        log.info("🔔 [DEBUG-NOTI] 1. Received Event for recipient: {}, type: {}", event.getRecipientId(), event.getType());

        try {
            // 1. Build metadata with imageUrl, actorName and deepLink
            String imageUrl = event.getImageUrl();
            String actorName = null;
            if (event.getActorIds() != null && !event.getActorIds().isEmpty()) {
                try {
                    String firstActorId = event.getActorIds().get(0);
                    User actor = userService.findUserById(Long.parseLong(firstActorId));
                    if (actor != null) {
                        actorName = actor.getName();
                        if (imageUrl == null) {
                            imageUrl = actor.getAvatarUrl();
                        }
                    }
                } catch (Exception e) {
                    log.warn("⚠️ Could not fetch actor info for notification: {}", e.getMessage());
                }
            }

            // Generate deepLink and extraData
            String deepLink = null;
            String extraData = null;
            
            if (event.getRootTargetId() != null) {
                deepLink = "/post/" + event.getRootTargetId();

                // Add extra info for comments/replies
                if (event.getTargetType() == TargetType.COMMENT) {
                    extraData = "{\"commentId\": \"" + event.getTargetId() + "\"}";
                }
            } else if (event.getTargetType() == TargetType.PAGE && event.getTargetId() != null) {
                // For page notifications, navigate to the page detail
                deepLink = "/pages/" + event.getTargetId();
            } else if (event.getType() == NotificationType.FRIEND_REQUEST ||
                       event.getType() == NotificationType.FRIEND_ACCEPT) {
                // For friend notifications, navigate to the actor's profile
                if (event.getActorIds() != null && !event.getActorIds().isEmpty()) {
                    try {
                        String firstActorId = event.getActorIds().get(0);
                        User actor = userService.findUserById(Long.parseLong(firstActorId));
                        if (actor != null && actor.getUsername() != null) {
                            deepLink = "/profile/" + actor.getUsername();
                        }
                    } catch (Exception e) {
                        log.warn("⚠️ Could not fetch actor username for deepLink: {}", e.getMessage());
                    }
                }
            }

            NotificationMetadata metadata = NotificationMetadata.builder()
                    .imageUrl(imageUrl)
                    .actorName(actorName)
                    .deepLink(deepLink)
                    .extraData(extraData)
                    .build();

            // 2. Persist to MongoDB (Source of Truth)
            Notification notification = Notification.builder()
                    .recipientId(event.getRecipientId())
                    .actorIds(event.getActorIds())
                    .type(event.getType())
                    .targetType(event.getTargetType())
                    .targetId(event.getTargetId())
                    .content(event.getContent())
                    .metadata(metadata)
                    .isRead(false)
                    .createdAt(Instant.now())
                    .expireAt(Instant.now().plusSeconds(90L * 24 * 60 * 60)) // 90 days TTL
                    .build();
            
            notification = notificationRepository.save(notification);
            log.info("✅ [MONGODB] Notification saved. ID: {}, Recipient: {}", notification.getId(), notification.getRecipientId());

            // 3. Update Redis Cache
            String userId = event.getRecipientId();
            String countKey = String.format(UNREAD_COUNT_KEY, userId);
            String zsetKey = String.format(RECENT_NOTIFICATIONS_KEY, userId);
            
            // Increment unread count
            stringRedisTemplate.opsForValue().increment(countKey);

            // Add to recent notifications (ZSET)
            String notificationJson = objectMapper.writeValueAsString(notification);
            double score = Instant.now().toEpochMilli();
            stringRedisTemplate.opsForZSet().add(zsetKey, notificationJson, score);
            
            // Trim ZSET
            stringRedisTemplate.opsForZSet().removeRange(zsetKey, 0, -(MAX_RECENT_NOTIFICATIONS + 1));
            log.info("🚀 [REDIS] Cache updated for user: {}", userId);

            // 4. Publish to Redis Pub/Sub for Real-time WebSockets
            Set<Long> targetMemberIds = Collections.emptySet();
            try {
                targetMemberIds = Set.of(Long.valueOf(userId));
            } catch (Exception e) {
                log.warn("⚠️ [WEBSOCKET] Recipient ID {} is not numeric, subscriber will fallback to payload.recipientId", userId);
            }
            
            RedisEnvelope envelope = new RedisEnvelope(
                    targetMemberIds,
                    DomainEventType.NOTIFICATION,
                    notification
            );

            pubSubRedisTemplate.convertAndSend(RedisPubSubConfig.NOTIFICATION_CHANNEL, envelope);
            log.info("📡 [DEBUG-NOTI] 2. Published to Redis channel for user: {}", userId);

        } catch (Exception e) {
            log.error("❌ [ERROR] Processing notification event: {}", e.getMessage(), e);
        }
    }
}
