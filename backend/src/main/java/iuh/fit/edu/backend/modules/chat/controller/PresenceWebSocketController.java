package iuh.fit.edu.backend.modules.chat.controller;

import iuh.fit.edu.backend.modules.chat.event.payload.UserStatusEvent;
import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.modules.user.service.UserPresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class PresenceWebSocketController {

    private final UserPresenceService userPresenceService;
    private final ApplicationEventPublisher eventPublisher;

    @MessageMapping("/presence/heartbeat")
    public void heartbeat(Principal principal, SimpMessageHeaderAccessor headers) {
        // Heartbeat này chỉ gia hạn TTL presence, không thay đổi nghiệp vụ chat/conversation cũ.
        if (principal == null || headers == null) {
            return;
        }

        String sessionId = headers.getSessionId();
        userPresenceService.findUserByPrincipalName(principal.getName())
                .ifPresent(user -> {
                    boolean newlyOnline = userPresenceService.refreshSession(user.getId(), sessionId);
                    if (newlyOnline) {
                        eventPublisher.publishEvent(new UserStatusEvent(
                                UserStatusResponse.builder()
                                        .userId(user.getId())
                                        .isOnline(true)
                                        .lastActiveAt(null)
                                        .build()
                        ));
                    }
                });
    }
}
