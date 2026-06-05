package iuh.fit.edu.backend.modules.chat.service.impl;

import iuh.fit.edu.backend.common.util.TransactionUtil;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.AddPollOptionRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.VotePollRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.LastMessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import iuh.fit.edu.backend.modules.chat.entity.Message;
import iuh.fit.edu.backend.modules.chat.entity.Poll;
import iuh.fit.edu.backend.modules.chat.event.payload.MessageCreatedEvent;
import iuh.fit.edu.backend.modules.chat.event.payload.PollUpdatedEvent;
import iuh.fit.edu.backend.modules.chat.mapper.MessageMapper;
import iuh.fit.edu.backend.modules.chat.mapper.PollMapper;
import iuh.fit.edu.backend.modules.chat.repository.MessageRepository;
import iuh.fit.edu.backend.modules.chat.repository.PollRepository;
import iuh.fit.edu.backend.modules.chat.service.MessageCacheService;
import iuh.fit.edu.backend.modules.chat.service.PollCacheService;
import iuh.fit.edu.backend.modules.chat.service.PollService;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.mapper.ConversationMapper;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.conversation.event.payload.ConversationUpdatedEvent;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PollServiceImpl implements PollService {
    private final PollRepository pollRepository;
    private final MessageRepository messageRepository;
    private final ConversationMemberService conversationMemberService;
    private final PollMapper pollMapper;
    private final MessageMapper messageMapper;
    private final PollCacheService pollCacheService;
    private final MessageCacheService messageCacheService;
    private final ConversationRepository conversationRepository;
    private final ConversationMapper conversationMapper;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public PollResponse getPoll(String pollId, Long userId) {
        Poll poll = findPoll(pollId);
        conversationMemberService.getMemberInfo(poll.getConversationId(), userId);
        PollResponse cached = pollCacheService.getPoll(pollId);
        if (cached != null) {
            return pollMapper.toResponse(poll, userId);
        }
        PollResponse response = pollMapper.toResponse(poll, userId);
        pollCacheService.cachePoll(response);
        return response;
    }

    @Override
    @Transactional
    public PollResponse vote(String pollId, VotePollRequest request, Long userId) {
        Poll poll = findPoll(pollId);
        validateCanInteract(poll, userId);
        List<String> optionIds = request.getOptionIds().stream()
                .filter(optionId -> optionId != null && !optionId.isBlank())
                .distinct()
                .toList();

        if (optionIds.isEmpty()) {
            throw new IllegalArgumentException("Danh sach lua chon khong duoc de trong");
        }
        if (!poll.isAllowMultipleChoices() && optionIds.size() > 1) {
            throw new IllegalArgumentException("Binh chon nay chi cho phep chon mot phuong an");
        }

        Set<String> existingOptionIds = poll.getOptions().stream()
                .map(Poll.Option::getId)
                .collect(java.util.stream.Collectors.toSet());
        if (!existingOptionIds.containsAll(optionIds)) {
            throw new IllegalArgumentException("Phuong an binh chon khong hop le");
        }

        boolean firstVote = poll.getOptions().stream()
                .noneMatch(option -> option.getVoterIds() != null && option.getVoterIds().contains(userId));

        poll.getOptions().forEach(option -> {
            if (option.getVoterIds() == null) {
                option.setVoterIds(new LinkedHashSet<>());
            }
            option.getVoterIds().remove(userId);
            if (optionIds.contains(option.getId())) {
                option.getVoterIds().add(userId);
            }
        });

        PollResponse response = saveAndPublish(poll, userId);
        createAndPublishPollSystemMessage(
                poll,
                userId,
                firstVote ? MessageType.SYSTEM_POLL_VOTED : MessageType.SYSTEM_POLL_CHANGED
        );
        return response;
    }

    @Override
    @Transactional
    public PollResponse removeVote(String pollId, Long userId) {
        Poll poll = findPoll(pollId);
        validateCanInteract(poll, userId);
        boolean hadVote = poll.getOptions().stream()
                .anyMatch(option -> option.getVoterIds() != null && option.getVoterIds().contains(userId));
        poll.getOptions().forEach(option -> {
            if (option.getVoterIds() != null) {
                option.getVoterIds().remove(userId);
            }
        });
        PollResponse response = saveAndPublish(poll, userId);
        if (hadVote) {
            createAndPublishPollSystemMessage(poll, userId, MessageType.SYSTEM_POLL_CHANGED);
        }
        return response;
    }

    @Override
    @Transactional
    public PollResponse addOption(String pollId, AddPollOptionRequest request, Long userId) {
        Poll poll = findPoll(pollId);
        validateCanInteract(poll, userId);
        if (!poll.isAllowAddOption()) {
            throw new IllegalArgumentException("Binh chon nay khong cho phep them phuong an");
        }
        if (poll.getOptions().size() >= 20) {
            throw new IllegalArgumentException("Binh chon chi ho tro toi da 20 phuong an");
        }
        String text = request.getText().trim();
        boolean duplicated = poll.getOptions().stream()
                .anyMatch(option -> option.getText().equalsIgnoreCase(text));
        if (duplicated) {
            throw new IllegalArgumentException("Phuong an nay da ton tai");
        }

        poll.getOptions().add(Poll.Option.builder()
                .id(UUID.randomUUID().toString())
                .text(text)
                .voterIds(new LinkedHashSet<>())
                .build());

        return saveAndPublish(poll, userId);
    }

    @Override
    @Transactional
    public PollResponse closePoll(String pollId, Long userId) {
        Poll poll = findPoll(pollId);
        var member = conversationMemberService.getMemberInfo(poll.getConversationId(), userId);
        boolean canClose = userId.equals(poll.getCreatorId())
                || member.getRole() == MemberRole.OWNER
                || member.getRole() == MemberRole.DEPUTY;
        if (!canClose) {
            throw new org.springframework.security.access.AccessDeniedException("Khong co quyen dong binh chon");
        }
        poll.setClosed(true);
        PollResponse response = saveAndPublish(poll, userId);
        createAndPublishPollSystemMessage(poll, userId, MessageType.SYSTEM_POLL_CLOSED);
        return response;
    }

    private Poll findPoll(String pollId) {
        return pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay binh chon"));
    }

    private void validateCanInteract(Poll poll, Long userId) {
        conversationMemberService.getMemberInfo(poll.getConversationId(), userId);
        if (poll.isClosed() || poll.isRecalled()) {
            throw new IllegalArgumentException("Binh chon da dong");
        }
        if (poll.getExpiresAt() != null && Instant.now().isAfter(poll.getExpiresAt())) {
            throw new IllegalArgumentException("Binh chon da het han");
        }
        Message message = messageRepository.findById(poll.getMessageId())
                .orElseThrow(() -> new RuntimeException("Khong tim thay tin nhan binh chon"));
        if (message.isRecalled()) {
            throw new IllegalArgumentException("Binh chon da bi thu hoi");
        }
        if (message.getDeletedFor() != null && message.getDeletedFor().contains(userId)) {
            throw new IllegalArgumentException("Khong the thao tac voi tin nhan da xoa o phia ban");
        }
    }

    private PollResponse saveAndPublish(Poll poll, Long userId) {
        poll.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        Poll saved = pollRepository.save(poll);
        PollResponse userResponse = pollMapper.toResponse(saved, userId);
        PollResponse broadcastResponse = pollMapper.toResponse(saved, null);

        TransactionUtil.executeAfterCommit(() -> {
            pollCacheService.cachePoll(broadcastResponse);
        });
        eventPublisher.publishEvent(new PollUpdatedEvent(broadcastResponse));

        return userResponse;
    }

    private void createAndPublishPollSystemMessage(Poll poll, Long userId, MessageType type) {
        Conversation conversation = conversationRepository.findById(poll.getConversationId())
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));
        ConversationMemberResponse senderInfo = conversationMemberService.getMemberInfo(poll.getConversationId(), userId);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        Message systemMessage = new Message();
        systemMessage.setMessageType(type);
        systemMessage.setContent(poll.getTitle());
        systemMessage.setSenderId(userId);
        systemMessage.setConversationId(poll.getConversationId());
        systemMessage.setPollId(poll.getId());
        systemMessage.setCreatedAt(now);
        systemMessage.setReplyInfo(Message.ReplyInfo.builder()
                .messageId(poll.getMessageId())
                .senderId(poll.getCreatorId())
                .type(MessageType.POLL)
                .content(poll.getTitle())
                .build());

        Message savedMessage = messageRepository.save(systemMessage);
        MessageResponse messageResponse = messageMapper.toMessageResponse(savedMessage);
        boolean anonymousActor = poll.isAnonymous()
                && (type == MessageType.SYSTEM_POLL_VOTED || type == MessageType.SYSTEM_POLL_CHANGED);
        if (anonymousActor) {
            messageResponse.setSenderId(0L);
        }
        LastMessageResponse lastMessageResponse = processPollSystemMessageSideEffects(
                conversation,
                savedMessage,
                senderInfo,
                messageResponse,
                anonymousActor
        );

        eventPublisher.publishEvent(new MessageCreatedEvent(messageResponse));
        Set<Long> memberIds = conversationMemberService.getAllMemberId(poll.getConversationId());
        eventPublisher.publishEvent(new ConversationUpdatedEvent(poll.getConversationId(), lastMessageResponse, memberIds));
    }

    private LastMessageResponse processPollSystemMessageSideEffects(
            Conversation conversation,
            Message savedMessage,
            ConversationMemberResponse senderInfo,
            MessageResponse messageResponse,
            boolean anonymousActor
    ) {
        TransactionUtil.executeAfterCommit(() -> messageCacheService.cacheNewMessage(messageResponse));

        conversation.setLastMessageId(savedMessage.getId());
        conversation.setLastMessageContent(getPollSystemSidebarPreview(savedMessage.getMessageType(), savedMessage.getContent()));
        conversation.setLastMessageAt(savedMessage.getCreatedAt());
        conversation.setLastSenderId(anonymousActor ? 0L : savedMessage.getSenderId());
        conversation.setLastSenderName(anonymousActor ? "Mot thanh vien" : senderInfo.getNickname());
        conversation.setLastMessageType(savedMessage.getMessageType());

        Conversation savedConversation = conversationRepository.save(conversation);
        conversationMemberRepository.incrementUnreadCount(savedConversation.getId(), senderInfo.getUserId());
        conversationMemberRepository.unhideConversationForAllMembers(savedConversation.getId());

        LastMessageResponse lastMessageResponse = conversationMapper.toLastMessageResponse(savedConversation);
        lastMessageResponse.setLastSenderId(anonymousActor ? 0L : savedMessage.getSenderId());
        lastMessageResponse.setLastSenderName(anonymousActor ? "Mot thanh vien" : senderInfo.getNickname());
        lastMessageResponse.setRead(false);
        return lastMessageResponse;
    }

    private String getPollSystemSidebarPreview(MessageType type, String title) {
        String pollTitle = title == null ? "" : title;
        return switch (type) {
            case SYSTEM_POLL_VOTED -> "Da tham gia cuoc binh chon: " + pollTitle;
            case SYSTEM_POLL_CHANGED -> "Da doi lua chon trong cuoc binh chon: " + pollTitle;
            case SYSTEM_POLL_CLOSED -> "Da khoa binh chon: " + pollTitle;
            default -> "Binh chon: " + pollTitle;
        };
    }
}
