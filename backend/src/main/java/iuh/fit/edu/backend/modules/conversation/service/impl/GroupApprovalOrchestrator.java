package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.modules.conversation.dto.request.AddMemberRequest;
import iuh.fit.edu.backend.modules.conversation.entity.GroupJoinRequest;
import iuh.fit.edu.backend.modules.conversation.event.payload.JoinRequestProcessedEvent;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import iuh.fit.edu.backend.modules.conversation.service.GroupJoinRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GroupApprovalOrchestrator {

    private final GroupJoinRequestService joinRequestService;
    private final ConversationMemberService memberService;
    private final ConversationMemberRepository memberRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(rollbackFor = Exception.class)
    public void executeApprovalFlow(Long requestId, Long adminId, boolean isApproved) {
        GroupJoinRequest request = joinRequestService.getRequestById(requestId);
        Long targetUserId = request.getUser().getId();
        Long conversationId = request.getConversation().getId();

        joinRequestService.processRequest(requestId, adminId, isApproved);

        if (isApproved) {
            AddMemberRequest addReq = new AddMemberRequest();
            addReq.setNewMemberIds(Collections.singleton(targetUserId));
            memberService.addMembers(conversationId, addReq, adminId);
        }
        Set<Long> adminIds = memberRepository.findAdminIdsByConversationId(conversationId);
        eventPublisher.publishEvent(new JoinRequestProcessedEvent(conversationId, requestId, adminIds));
    }
}
