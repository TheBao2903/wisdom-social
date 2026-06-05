package iuh.fit.edu.backend.modules.page.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.page.event.payload.PageListEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Handles PAGE_UPDATED → /topic/pages */
@Slf4j
@Component
@RequiredArgsConstructor
public class PageUpdatedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() { return PageListEvent.class; }

    @Override
    public String getSupportedEventType() { return DomainEventType.PAGE_UPDATED.toString(); }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        PageListEvent event = (PageListEvent) eventPayload;
        log.info("Broadcasting PAGE_UPDATED for page {}", event.getPageId());
        messagingTemplate.convertAndSend("/topic/pages", event);
    }
}
