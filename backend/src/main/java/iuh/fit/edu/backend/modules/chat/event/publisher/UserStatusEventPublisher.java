package iuh.fit.edu.backend.modules.chat.event.publisher;

import iuh.fit.edu.backend.modules.chat.event.payload.UserStatusEvent;
import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserPresenceService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserStatusEventPublisher {

    private final UserPresenceService userPresenceService;
    private final UserService userService;
    private final ApplicationEventPublisher eventPublisher;

    @EventListener
    public void handleUserConnect(SessionConnectedEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();
        resolveUser(event.getUser()).ifPresent(user -> {
            boolean newlyOnline = userPresenceService.registerSession(user.getId(), sessionId);
            if (newlyOnline) {
                publishStatus(user.getId(), true, null);
            }
        });
    }

    @EventListener
    public void handleUserDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        Long userId = resolveUser(event.getUser())
                .map(User::getId)
                .or(() -> userPresenceService.findUserIdBySessionId(sessionId))
                .orElse(null);
        if (userId == null) {
            return;
        }

        boolean fullyOffline = userPresenceService.removeSession(userId, sessionId);
        if (fullyOffline) {
            Instant lastActiveAt = userService.updateLastActiveAt(userId);
            publishStatus(userId, false, lastActiveAt);
        }
    }

    @Scheduled(fixedDelay = 30000)
    public void cleanupExpiredPresenceSessions() {
        // Dọn các session không còn heartbeat để tránh user bị treo online khi mất mạng đột ngột.
        userPresenceService.cleanupExpiredSessions().forEach(userId -> {
            Instant lastActiveAt = userService.updateLastActiveAt(userId);
            publishStatus(userId, false, lastActiveAt);
        });
    }

    private java.util.Optional<User> resolveUser(Principal principal) {
        if (principal == null) {
            return java.util.Optional.empty();
        }
        return userPresenceService.findUserByPrincipalName(principal.getName());
    }

    private void publishStatus(Long userId, boolean online, Instant lastActiveAt) {
        UserStatusResponse payload = UserStatusResponse.builder()
                .userId(userId)
                .isOnline(online)
                .lastActiveAt(lastActiveAt)
                .build();
        eventPublisher.publishEvent(new UserStatusEvent(payload));
    }
}
