package iuh.fit.edu.backend.modules.page.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.page.event.payload.PagePostEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Handles PAGE_POST_REJECTED → /topic/page/{pageId}/posts */
@Slf4j
@Component
@RequiredArgsConstructor
public class PagePostRejectedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() { return PagePostEvent.class; }

    @Override
    public String getSupportedEventType() { return DomainEventType.PAGE_POST_REJECTED.toString(); }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        PagePostEvent event = (PagePostEvent) eventPayload;
        log.info("Broadcasting PAGE_POST_REJECTED for page {} post {}", event.getPageId(), event.getPostId());
        messagingTemplate.convertAndSend("/topic/page/" + event.getPageId() + "/posts", event);
    }
}
