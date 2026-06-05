package iuh.fit.edu.backend.modules.post.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import iuh.fit.edu.backend.modules.post.event.payload.ReactionEvent;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReactionRealtimeEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return ReactionEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return "REACTION";
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        if (eventPayload instanceof ReactionEvent) {
            ReactionEvent event = (ReactionEvent) eventPayload;
            String postId = event.getRootPostId();
            
            String destination = "/topic/post/" + postId + "/reactions";
            log.info("Broadcasting realtime reaction action {} to destination: {}", event.getAction(), destination);
            
            // Push entire ReactionRealtimeEvent to subscribers
            messagingTemplate.convertAndSend(destination, event);
        }
    }
}
