package iuh.fit.edu.backend.modules.post.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import iuh.fit.edu.backend.modules.post.event.payload.PostEvent;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class PostRealtimeEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return PostEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return "POST";
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        if (eventPayload instanceof PostEvent) {
            PostEvent event = (PostEvent) eventPayload;
            String authorId = event.getAuthorId();
            
            // 1. Broadcast to global posts topic (for Feed)
            String globalDestination = "/topic/posts";
            log.info("Broadcasting global post action {} to destination: {}", event.getAction(), globalDestination);
            messagingTemplate.convertAndSend(globalDestination, event);
            
            // 2. Broadcast to specific user posts topic (for Profile)
            if (authorId != null) {
                String profileDestination = "/topic/user/" + authorId + "/posts";
                log.info("Broadcasting profile post action {} to destination: {}", event.getAction(), profileDestination);
                messagingTemplate.convertAndSend(profileDestination, event);
            }
        }
    }
}
