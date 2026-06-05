package iuh.fit.edu.backend.modules.notification.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.modules.notification.entity.mongodb.Notification;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.notification.repository.NotificationRepository;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final RedisTemplate<String, Object> pubSubRedisTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public NotificationServiceImpl(
            NotificationRepository notificationRepository,
            ApplicationEventPublisher eventPublisher,
            @Qualifier("pubSubRedisTemplate") RedisTemplate<String, Object> pubSubRedisTemplate,
            StringRedisTemplate stringRedisTemplate,
            @Qualifier("pubSubObjectMapper") ObjectMapper objectMapper) {
        this.notificationRepository = notificationRepository;
        this.eventPublisher = eventPublisher;
        this.pubSubRedisTemplate = pubSubRedisTemplate;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
    }

    private static final String UNREAD_COUNT_KEY = "notification:unread:%s";
    private static final String RECENT_NOTIFICATIONS_KEY = "notification:recent:%s";

    @Override
    public void createNotification(NotificationEvent event) {
        log.info("Publishing NotificationEvent for recipient: {}", event.getRecipientId());
        eventPublisher.publishEvent(event);
    }

    @Override
    public List<Notification> getNotifications(String userId, int page, int size) {
        String zsetKey = String.format(RECENT_NOTIFICATIONS_KEY, userId);
        
        // If it's the first page, try to get from Redis ZSET
        if (page == 0) {
            // Use reverseRange to get newest notifications (highest score first)
            Set<String> recentData = stringRedisTemplate.opsForZSet().reverseRange(zsetKey, 0, size - 1);
            if (recentData != null && !recentData.isEmpty()) {
                log.info("Returning notifications from Redis cache for user: {}", userId);
                return recentData.stream()
                        .map(json -> {
                            try {
                                return objectMapper.readValue(json, Notification.class);
                            } catch (Exception e) {
                                log.error("Error converting notification from cache", e);
                                return null;
                            }
                        })
                        .filter(n -> n != null)
                        .collect(Collectors.toList());
            }
        }

        // Fallback to MongoDB
        log.info("Fetching notifications from MongoDB for user: {}, page: {}", userId, page);
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(
                userId, 
                PageRequest.of(page, size)
        ).getContent();
    }

    @Override
    public long getUnreadCount(String userId) {
        String countKey = String.format(UNREAD_COUNT_KEY, userId);
        String countStr = stringRedisTemplate.opsForValue().get(countKey);
        
        if (countStr != null) {
            try {
                return Long.parseLong(countStr);
            } catch (NumberFormatException e) {
                log.error("Invalid count format in Redis for user {}", userId);
            }
        }
        
        // Cache miss: Count from MongoDB and update cache
        long count = notificationRepository.countByRecipientIdAndIsReadFalse(userId);
        stringRedisTemplate.opsForValue().set(countKey, String.valueOf(count));
        return count;
    }

    @Override
    public void markAsRead(String notificationId, String userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!notification.getRecipientId().equals(userId)) {
            throw new RuntimeException("Unauthorized to mark this notification as read");
        }

        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(Instant.now());
            notificationRepository.save(notification);

            // Update Redis Count
            String countKey = String.format(UNREAD_COUNT_KEY, userId);
            Long currentCount = stringRedisTemplate.opsForValue().decrement(countKey);
            if (currentCount != null && currentCount < 0) {
                stringRedisTemplate.opsForValue().set(countKey, "0");
            }

            // Clear recent notifications cache to ensure consistency
            String zsetKey = String.format(RECENT_NOTIFICATIONS_KEY, userId);
            stringRedisTemplate.delete(zsetKey);
        }
    }

    @Override
    public void markAllAsRead(String userId) {
        // 1. Update in MongoDB
        List<Notification> unreadNotifications = notificationRepository.findByRecipientIdAndIsReadFalse(userId);
        if (!unreadNotifications.isEmpty()) {
            Instant now = Instant.now();
            unreadNotifications.forEach(n -> {
                n.setRead(true);
                n.setReadAt(now);
            });
            notificationRepository.saveAll(unreadNotifications);
        }

        // 2. Reset Redis Count
        String countKey = String.format(UNREAD_COUNT_KEY, userId);
        stringRedisTemplate.opsForValue().set(countKey, "0");

        // 3. Clear Recent Notifications Cache
        String zsetKey = String.format(RECENT_NOTIFICATIONS_KEY, userId);
        stringRedisTemplate.delete(zsetKey);

        log.info("Marked all notifications as read for user: {}", userId);
    }

    @Override
    public void clearCache(String userId) {
        String countKey = String.format(UNREAD_COUNT_KEY, userId);
        String zsetKey = String.format(RECENT_NOTIFICATIONS_KEY, userId);
        stringRedisTemplate.delete(countKey);
        stringRedisTemplate.delete(zsetKey);
        log.info("Cleared notification cache for user: {}", userId);
    }
}
