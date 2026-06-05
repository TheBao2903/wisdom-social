package iuh.fit.edu.backend.modules.notification.service;

import iuh.fit.edu.backend.modules.notification.entity.mongodb.Notification;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;

import java.util.List;

public interface NotificationService {
    void createNotification(NotificationEvent event);
    List<Notification> getNotifications(String userId, int page, int size);
    long getUnreadCount(String userId);
    void markAsRead(String notificationId, String userId);
    void markAllAsRead(String userId);
    void clearCache(String userId);
}
