package iuh.fit.edu.backend.modules.post.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import iuh.fit.edu.backend.modules.post.event.payload.CommentEvent;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class CommentRealtimeEventHandler implements RedisEventHandler {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() {
        return CommentEvent.class;
    }

    @Override
    public String getSupportedEventType() {
        return "COMMENT";
    }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        if (eventPayload instanceof CommentEvent) {
            CommentEvent event = (CommentEvent) eventPayload;
            String postId = event.getPostId();
            
            String destination = "/topic/post/" + postId + "/comments";
            log.info("Broadcasting realtime comment action {} to destination: {}", event.getAction(), destination);
            
            // Push entire CommentRealtimeEvent (action, postId, payload) to subscribers
            messagingTemplate.convertAndSend(destination, event);
        }
    }
}
