package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.event.handler.RedisEventHandler;
import iuh.fit.edu.backend.modules.conversation.event.payload.GroupDisbandedEvent;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class GroupDisbandedEventHandler implements RedisEventHandler {
    
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public Class<?> getSupportedClass() { return GroupDisbandedEvent.class; } // Chỉ cần truyền ID phòng

    @Override
    public String getSupportedEventType() { return DomainEventType.GROUP_DISBANDED.toString(); }

    @Override
    public void handle(Object eventPayload, Set<Long> targetMemberIds) {
        GroupDisbandedEvent event = (GroupDisbandedEvent) eventPayload;

        if (targetMemberIds == null || targetMemberIds.isEmpty())
            return;
        for(Long memberId : targetMemberIds){
            String destination = "/topic/user/" + memberId + "/conversations";
            messagingTemplate.convertAndSend(destination, event);
        }
        log.info("Broadcast group disband to {} members", event.getMemberIds());


    }
}