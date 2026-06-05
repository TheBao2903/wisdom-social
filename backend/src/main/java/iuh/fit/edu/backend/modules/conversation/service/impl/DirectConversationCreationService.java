package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.common.util.TransactionUtil;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.DirectConversationResolveResult;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.mapper.ConversationMemberMapper;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberCacheService;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DirectConversationCreationService {
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final UserRepository userRepository;
    private final ConversationMemberMapper conversationMemberMapper;
    private final ConversationMemberCacheService memberCacheService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DirectConversationResolveResult create(Long senderId, Long receiverId, String directKey) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        Conversation conversation = new Conversation();
        conversation.setType(ConversationType.DIRECT);
        conversation.setDirectKey(directKey);
        conversation.setUpdatedAt(now);
        Conversation savedConversation = conversationRepository.saveAndFlush(conversation);

        ConversationMember senderMember = buildMember(savedConversation, senderId, now);
        ConversationMember receiverMember = buildMember(savedConversation, receiverId, now);
        List<ConversationMember> savedMembers = conversationMemberRepository.saveAll(List.of(senderMember, receiverMember));
        savedConversation.setMembers(savedMembers);

        Map<Long, ConversationMemberResponse> memberMap = savedMembers.stream()
                .map(conversationMemberMapper::toConversationMemberResponse)
                .collect(Collectors.toMap(ConversationMemberResponse::getUserId, member -> member));

        TransactionUtil.executeAfterCommit(() -> memberCacheService.saveMembersMap(savedConversation.getId(), memberMap));

        return new DirectConversationResolveResult(savedConversation, true);
    }

    private ConversationMember buildMember(Conversation conversation, Long userId, Instant now) {
        ConversationMember member = new ConversationMember();
        member.setConversation(conversation);
        member.setUser(userRepository.getReferenceById(userId));
        member.setRole(MemberRole.MEMBER);
        member.setStatus(ConversationMemberStatus.ACTIVE);
        member.setJoinedAt(now);
        return member;
    }
}
