package iuh.fit.edu.backend.modules.page.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.page.event.payload.PageEvent;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class PageMemberUnblockedEventHandler implements RedisEventHandler {
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() { return PageEvent.class; }

    @Override
    public String getSupportedEventType() { return DomainEventType.PAGE_MEMBER_UNBLOCKED.toString(); }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        PageEvent event = (PageEvent) eventPayload;
        if (event.isSendToPage()) messagingTemplate.convertAndSend("/topic/page/" + event.getPageId() + "/members", event);
        if (event.isSendToUser()) messagingTemplate.convertAndSend("/topic/user/" + event.getUserId() + "/page-events", event);
    }
}
