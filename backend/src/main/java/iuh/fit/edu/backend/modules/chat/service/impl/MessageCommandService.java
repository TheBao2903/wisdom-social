/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service.impl;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import iuh.fit.edu.backend.common.constant.UploadModule;
import iuh.fit.edu.backend.common.service.s3.S3Service;
import iuh.fit.edu.backend.common.util.TransactionUtil;
import iuh.fit.edu.backend.common.util.heplper.ChatSnapshotHelper;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.chat.dto.request.ForwardMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.SendCallMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.SendMessageRequest;
import iuh.fit.edu.backend.modules.chat.dto.request.poll.CreatePollRequest;
import iuh.fit.edu.backend.modules.chat.dto.response.LastMessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageRecalledResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import iuh.fit.edu.backend.modules.chat.entity.Message;
import iuh.fit.edu.backend.modules.chat.entity.Poll;
import iuh.fit.edu.backend.modules.chat.event.payload.MessageCreatedEvent;
import iuh.fit.edu.backend.modules.chat.event.payload.MessageRecalledEvent;
import iuh.fit.edu.backend.modules.chat.mapper.MessageMapper;
import iuh.fit.edu.backend.modules.chat.mapper.PollMapper;
import iuh.fit.edu.backend.modules.chat.repository.MessageRepository;
import iuh.fit.edu.backend.modules.chat.repository.PollRepository;
import iuh.fit.edu.backend.modules.chat.service.MessageCacheService;
import iuh.fit.edu.backend.modules.chat.service.PollCacheService;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.constant.MemberRole;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationResponse;
import iuh.fit.edu.backend.modules.conversation.dto.response.DirectConversationResolveResult;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import iuh.fit.edu.backend.modules.conversation.entity.FrozenLastMessage;
import iuh.fit.edu.backend.modules.conversation.entity.PinnedMessageDetail;
import iuh.fit.edu.backend.modules.conversation.event.payload.ConversationCreatedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.ConversationUpdatedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.PinUpdatedEvent;
import iuh.fit.edu.backend.modules.conversation.mapper.ConversationMapper;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import iuh.fit.edu.backend.modules.conversation.service.DirectConversationService;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageCommandService {
    private static final int SIDEBAR_PREVIEW_MAX_LENGTH = 240;

    private final MessageRepository messageRepository;
    private final ConversationMemberService conversationMemberService;
    private final ApplicationEventPublisher eventPublisher;
    private final MessageMapper messageMapper;
    private final ConversationRepository conversationRepository;
    private final ConversationMapper conversationMapper;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageCacheService messageCacheService;
    private final PollRepository pollRepository;
    private final PollMapper pollMapper;
    private final PollCacheService pollCacheService;
    private final S3Service s3Service;
    private final ObjectMapper objectMapper;
    private final ChatSnapshotHelper chatSnapshotHelper;
    private final DirectConversationService directConversationService;
    private final BlockUserRepository blockUserRepository;

    /**
     * Hàm xử lý việc gửi tin nhắn
     */
    @Transactional
    public MessageResponse sendMessage(SendMessageRequest sendMessageRequest, Long userId) {
        DirectConversationResolveResult directResolveResult = null;
        // Kiểm tra phòng còn tồn tại hay không
        Conversation conversation;
        if (sendMessageRequest.getConversationId() != null) {
            conversation = this.conversationRepository.findById(sendMessageRequest.getConversationId())
                .orElseThrow(() -> new RuntimeException("Không tim thấy cuộc trò chuyện"));

        // Lấy ra thông tin của người gửi (lần đầu tiên thì lấy từ db, những lần khác còn trong thời gian thì lấy từ redis cache)
        } else if (sendMessageRequest.getReceiverId() != null) {
            directResolveResult = directConversationService
                    .getOrCreateDirectConversation(userId, sendMessageRequest.getReceiverId());
            Long conversationId = directResolveResult.conversation().getId();
            sendMessageRequest.setConversationId(conversationId);
            conversation = this.conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));
        } else {
            throw new IllegalArgumentException("conversationId hoac receiverId la bat buoc");
        }

        ConversationMemberResponse senderInfo = conversationMemberService
                .getMemberInfo(sendMessageRequest.getConversationId(), userId);

        validateCanSendToConversation(conversation, senderInfo);

        // Lưu tin nhắn vào mongo
        String clientMessageId = normalizeClientMessageId(sendMessageRequest.getClientMessageId());
        if (clientMessageId != null) {
            Optional<Message> existingMessage = messageRepository
                    .findByConversationIdAndSenderIdAndClientMessageId(
                            conversation.getId(),
                            senderInfo.getUserId(),
                            clientMessageId
                    );
            if (existingMessage.isPresent()) {
                return this.messageMapper.toMessageResponse(existingMessage.get());
            }
        }

        Message newMessage = new Message();
        newMessage.setContent(sendMessageRequest.getContent());
        newMessage.setMessageType(sendMessageRequest.getType());
        newMessage.setSenderId(senderInfo.getUserId());
        newMessage.setConversationId(conversation.getId());
        newMessage.setClientMessageId(clientMessageId);
        newMessage.setCreatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        newMessage.setReplyInfo(buildReplyInfo(sendMessageRequest.getReplyToId()));
        newMessage.setAttachments(mapAttachments(sendMessageRequest.getAttachments()));

        Message savedMessage;
        try {
            savedMessage = messageRepository.save(newMessage);
        } catch (DuplicateKeyException ex) {
            if (clientMessageId == null) {
                throw ex;
            }
            Message existingMessage = messageRepository
                    .findByConversationIdAndSenderIdAndClientMessageId(
                            conversation.getId(),
                            senderInfo.getUserId(),
                            clientMessageId
                    )
                    .orElseThrow(() -> ex);
            return this.messageMapper.toMessageResponse(existingMessage);
        }
        MessageResponse messageResponse = this.messageMapper.toMessageResponse(savedMessage);

        // XỬ LÝ SIDE EFFECTS (CÁC TÁC VỤ PHỤ)
        LastMessageResponse lastMessageResponse = processPostMessageSideEffects(
                conversation, savedMessage, senderInfo, messageResponse
        );

        // Ban su kien gui tin nhan di cho cac noi dang ky
        publishMessageEvents(conversation.getId(), messageResponse, lastMessageResponse);
        if (directResolveResult != null && directResolveResult.created()) {
            enrichAndPublishDirectConversationCreated(conversation.getId(), userId, messageResponse);
        }

        return messageResponse;
    }

    @Transactional
    public MessageResponse createPoll(CreatePollRequest request, Long userId) {
        Conversation conversation = this.conversationRepository.findById(request.getConversationId())
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));

        ConversationMemberResponse senderInfo = conversationMemberService
                .getMemberInfo(request.getConversationId(), userId);
        validateCanSendToConversation(conversation, senderInfo);

        List<String> optionTexts = Optional.ofNullable(request.getOptions())
                .orElse(Collections.emptyList())
                .stream()
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();

        Set<String> normalizedOptionTexts = new HashSet<>();
        boolean duplicatedOption = optionTexts.stream()
                .map(value -> value.toLowerCase(java.util.Locale.ROOT))
                .anyMatch(value -> !normalizedOptionTexts.add(value));
        if (duplicatedOption) {
            throw new IllegalArgumentException("Khong duoc trung lua chon");
        }

        if (optionTexts.size() < 2) {
            throw new IllegalArgumentException("Binh chon can it nhat 2 phuong an");
        }

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        Poll poll = Poll.builder()
                .conversationId(conversation.getId())
                .creatorId(senderInfo.getUserId())
                .title(request.getTitle().trim())
                .allowMultipleChoices(request.isAllowMultipleChoices())
                .allowAddOption(request.isAllowAddOption())
                .anonymous(request.isAnonymous())
                .closed(false)
                .recalled(false)
                .expiresAt(request.getExpiresAt())
                .createdAt(now)
                .updatedAt(now)
                .options(optionTexts.stream()
                        .map(text -> Poll.Option.builder()
                                .id(UUID.randomUUID().toString())
                                .text(text)
                                .voterIds(new LinkedHashSet<>())
                                .build())
                        .toList())
                .build();

        Poll savedPoll = pollRepository.save(poll);

        Message pollMessage = new Message();
        pollMessage.setContent(savedPoll.getTitle());
        pollMessage.setMessageType(MessageType.POLL);
        pollMessage.setSenderId(senderInfo.getUserId());
        pollMessage.setConversationId(conversation.getId());
        pollMessage.setPollId(savedPoll.getId());
        pollMessage.setCreatedAt(now);

        Message savedMessage = messageRepository.save(pollMessage);
        savedPoll.setMessageId(savedMessage.getId());
        Poll finalSavedPoll = pollRepository.save(savedPoll);

        MessageResponse messageResponse = this.messageMapper.toMessageResponse(savedMessage);
        PollResponse pollResponse = pollMapper.toResponse(finalSavedPoll, userId);
        messageResponse.setPoll(pollResponse);

        LastMessageResponse lastMessageResponse = processPostMessageSideEffects(
                conversation, savedMessage, senderInfo, messageResponse
        );

        TransactionUtil.executeAfterCommit(() -> {
            pollCacheService.cachePoll(pollMapper.toResponse(finalSavedPoll, null));
        });

        publishMessageEvents(conversation.getId(), messageResponse, lastMessageResponse);
        createAndPublishSystemMessage(savedMessage.getId(), userId, conversation.getId(), MessageType.SYSTEM_POLL_CREATED, savedPoll.getTitle());

        return messageResponse;
    }

    @Transactional
    public List<MessageResponse> forwardMessage(ForwardMessageRequest request, Long userId) {
        List<Long> targetConversationIds = Optional.ofNullable(request.getTargetConversationIds())
                .orElse(Collections.emptyList())
                .stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(ArrayList::new));

        targetConversationIds = new ArrayList<>(new LinkedHashSet<>(targetConversationIds));
        if (targetConversationIds.isEmpty()) {
            throw new IllegalArgumentException("Danh sách cuộc trò chuyện nhận không được để trống");
        }

        Message sourceMessage = messageRepository.findById(request.getSourceMessageId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn cần chuyển tiếp"));

        validateForwardSourceMessage(sourceMessage, userId);

        List<ForwardTargetContext> targetContexts = targetConversationIds.stream()
                .map(targetConversationId -> {
                    Conversation targetConversation = conversationRepository.findById(targetConversationId)
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện nhận"));
                    ConversationMemberResponse senderInfo = conversationMemberService
                            .getMemberInfo(targetConversationId, userId);
                    validateCanSendToConversation(targetConversation, senderInfo);
                    return new ForwardTargetContext(targetConversation, senderInfo);
                })
                .toList();

        List<String> copiedAttachmentKeys = new ArrayList<>();
        try {
            List<Message> preparedMessages = targetContexts.stream()
                    .map(targetContext -> buildForwardMessage(
                            sourceMessage,
                            targetContext.conversation().getId(),
                            targetContext.senderInfo().getUserId(),
                            copiedAttachmentKeys
                    ))
                    .toList();

            List<MessageResponse> forwardedMessages = new ArrayList<>();
            List<ForwardPublishPayload> publishPayloads = new ArrayList<>();

            for (int i = 0; i < preparedMessages.size(); i++) {
                ForwardTargetContext targetContext = targetContexts.get(i);
                Message savedMessage = messageRepository.save(preparedMessages.get(i));
                MessageResponse messageResponse = messageMapper.toMessageResponse(savedMessage);
                LastMessageResponse lastMessageResponse = processPostMessageSideEffects(
                        targetContext.conversation(), savedMessage, targetContext.senderInfo(), messageResponse
                );

                forwardedMessages.add(messageResponse);
                publishPayloads.add(new ForwardPublishPayload(
                        targetContext.conversation().getId(),
                        messageResponse,
                        lastMessageResponse
                ));
            }

            publishPayloads.forEach(payload -> publishMessageEvents(
                    payload.conversationId(),
                    payload.messageResponse(),
                    payload.lastMessageResponse()
            ));

            return forwardedMessages;
        } catch (RuntimeException e) {
            deleteCopiedForwardAttachments(copiedAttachmentKeys);
            throw e;
        }
    }

    /**
     * Hàm xử lý việc ghim tin nhắn
     */
    @Transactional
    public void pinMessage(String messageId, Long userId) {
        Message targetMessage = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));
        Long conversationId = targetMessage.getConversationId();

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        ConversationMemberResponse senderInfo = conversationMemberService
                .getMemberInfo(conversationId, userId);
        if (senderInfo == null) {
            throw new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện");
        }

        List<PinnedMessageDetail> pinnedList = conversation.getPinnedMessages() != null
                ? new ArrayList<>(conversation.getPinnedMessages())
                : new ArrayList<>();

        // Kiểm tra nếu tin nhắn đã ghim rồi thì không ghim lại
        if (pinnedList.stream().anyMatch(p -> p.getMessageId().equals(messageId))) {
            throw new RuntimeException("Tin nhắn này đã được ghim");
        }

        // Luôn đảm bảo danh sách ghim không quá 3 tin
        // Nếu đã có 3 tin, bỏ ghim tin cũ nhất (index 0) trước khi thêm tin mới
        if (pinnedList.size() > 2) {
            PinnedMessageDetail oldest = pinnedList.remove(0);
            // Tạo tin nhắn hệ thống thông báo "Bỏ ghim"
            // User sẽ thấy: "{user_name} đã bỏ ghim một tin nhắn"
            createAndPublishSystemMessage(
                    oldest.getMessageId(), userId, conversationId,
                    MessageType.SYSTEM_UPIN, "đã bỏ ghim một tin nhắn"
            );
        }
        MessageType type = targetMessage.getMessageType();
        boolean checkType = type == MessageType.IMAGE
                || type == MessageType.VIDEO
                || type == MessageType.FILE
                || type == MessageType.AUDIO;
        // Thêm tin mới vào danh sách ghim
        pinnedList.add(new PinnedMessageDetail(messageId,
                userId, Instant.now().truncatedTo(ChronoUnit.MILLIS),
                targetMessage.getSenderId(),
                getPinnedMessageContent(targetMessage, checkType),
                targetMessage.getMessageType()));

        // Gán list mới để Hibernate detect dirty cho cột JSON pin list
        conversation.setPinnedMessages(pinnedList);
        conversationRepository.save(conversation);

        // Tạo tin nhắn hệ thống thông báo "Đã ghim"
        // User sẽ thấy: "{user_name} đã ghim một tin nhắn"
        createAndPublishSystemMessage(
                messageId, userId, conversationId,
                targetMessage.getMessageType() == MessageType.POLL ? MessageType.SYSTEM_POLL_PINNED : MessageType.SYSTEM_PIN,
                targetMessage.getMessageType() == MessageType.POLL ? targetMessage.getContent() : "đã ghim một tin nhắn"
        );

        // Bắn event cập nhật danh sách ghim trên Header cho tất cả members
        eventPublisher.publishEvent(new PinUpdatedEvent(conversationId, pinnedList));
    }

    /**
     * Hàm xử lý việc bỏ ghim tin nhắn
     */
    @Transactional
    public void unpinMessage(String messageId, Long userId) {
        Message targetMessage = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));
        Long conversationId = targetMessage.getConversationId();

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        ConversationMemberResponse senderInfo = conversationMemberService
                .getMemberInfo(conversationId, userId);
        if (senderInfo == null) {
            throw new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện");
        }

        List<PinnedMessageDetail> pinnedList = conversation.getPinnedMessages() != null
                ? new ArrayList<>(conversation.getPinnedMessages())
                : new ArrayList<>();

        // Kiểm tra nếu tin nhắn không có trong danh sách ghim thì báo lỗi
        boolean removed = pinnedList.removeIf(p -> p.getMessageId().equals(messageId));
        if (!removed) {
            throw new RuntimeException("Tin nhắn này chưa được ghim");
        }

        // Cập nhật danh sách ghim
        conversation.setPinnedMessages(pinnedList);
        conversationRepository.save(conversation);

        // Tạo tin nhắn hệ thống thông báo "Bỏ ghim"
        createAndPublishSystemMessage(
                null, userId, conversationId,
                MessageType.SYSTEM_UPIN, "đã bỏ ghim một tin nhắn"
        );

        // Bắn event cập nhật danh sách ghim trên Header cho tất cả members
        eventPublisher.publishEvent(new PinUpdatedEvent(conversationId, pinnedList));
    }

    @Transactional
    public MessageResponse addReaction(String messageId, Long userId, String emoji) {
        String normalizedEmoji = Optional.ofNullable(emoji)
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .orElseThrow(() -> new IllegalArgumentException("Emoji không được để trống"));

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));

        conversationMemberService.getMemberInfo(message.getConversationId(), userId);

        Message updatedMessage = messageRepository
                .incrementReactionCounter(messageId, userId, normalizedEmoji)
                .orElseThrow(() -> new RuntimeException("Không thể cập nhật reaction"));

        MessageResponse response = messageMapper.toMessageResponse(updatedMessage);
        
        messageCacheService.updateMessage(response);
        eventPublisher.publishEvent(new iuh.fit.edu.backend.modules.chat.event.payload.MessageReactionEvent(response));
        
        return response;
    }

    /**
     * Hàm xử lý việc gọi
     */
    @Transactional
    public MessageResponse sendCallMessage(SendCallMessageRequest sendCallMessageRequest, Long userId) {
        SendMessageRequest request = new SendMessageRequest();
        request.setConversationId(sendCallMessageRequest.getConversationId());
        request.setType(MessageType.CALL);
        request.setContent(buildCallMessageContent(sendCallMessageRequest));
        return sendMessage(request, userId);
    }

    /**
     * Hàm xử lý việc thu hồi tin nhắn
     */
    @Transactional
    public MessageRecalledResponse recallMessage(String messageId, Long userId) {
        Message message = this.messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));
        if (!userId.equals(message.getSenderId())) {
            throw new AccessDeniedException("Không có quyền truy cập");
        }
        Instant messageTime = message.getCreatedAt();

        if (Instant.now().isAfter(messageTime.plus(Duration.ofHours(24)))) {
            throw new IllegalArgumentException("Bạn chỉ có thể thu hồi tin nhắn trong vòng 24 giờ");
        }
        Conversation conversation = conversationRepository.findById(message.getConversationId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy cuộc trò chuyện"));

        // KIỂM TRA VÀ TỰ ĐỘNG BỎ GHIM
        handleUnpinOnRecall(conversation, messageId, userId);
        // Trích xuất list ảnh để xóa sau khi commit (Tránh bị Rollback nhưng mất file)
        List<Message.MediaAttachment> attachmentsToDelete = message.getAttachments();

        message.setAttachments(null);
        message.setContent("");
        message.setRecalled(true);
        this.messageRepository.save(message);
        closePollOnRecall(message);

        // Cập nhật lại các tin nhắn reply lại tin nhắn đang thu hồi
        messageRepository.updateContentOfRepliedMessages(messageId);
        MessageRecalledResponse messageRecalledResponse = new MessageRecalledResponse(message.getId(), message.getConversationId(), message.getCreatedAt());

        // Cập nhật  S3 va Redis cache để tránh trả về tin nhắn cũ
        TransactionUtil.executeAfterCommit(() -> {
            deleteS3Attachments(attachmentsToDelete);
            messageCacheService.updateMessage(messageRecalledResponse);
        });

        //Publish Event
        this.eventPublisher.publishEvent(new MessageRecalledEvent(messageRecalledResponse));

        // Cập nhật lại side bar nếu đây là tin nhắn cuối cùng
        updateSidebarIfLastMessage(message, conversation, userId);
        return messageRecalledResponse;
    }

    /**
     * Hàm xử lý việc xóa tin nhắn ở một phía
     */
    @Transactional
    public void deleteMessageForMe(String messageId, Long userId) {
        Message message = this.messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));

        // Đánh dấu xóa trong MongoDB và cập nhật Redis Cache
        markMessageAsDeletedForUser(message, userId);

        // Xử lý Mặt nạ (Override Mask) cho Sidebar nếu đây là tin nhắn cuối cùng
        handleOverrideMaskForSidebar(message.getConversationId(), messageId, userId);
    }


    //  HÀM TẠO TIN NHẮN HỆ THỐNG VÀ CẬP NHẬT SIDEBAR
    private void validateForwardSourceMessage(Message sourceMessage, Long userId) {
        conversationMemberService.getMemberInfo(sourceMessage.getConversationId(), userId);

        if (sourceMessage.isRecalled()) {
            throw new IllegalArgumentException("Không thể chuyển tiếp tin nhắn đã thu hồi");
        }
        if (sourceMessage.getDeletedFor() != null && sourceMessage.getDeletedFor().contains(userId)) {
            throw new IllegalArgumentException("Không thể chuyển tiếp tin nhắn đã xóa ở phía bạn");
        }
        if (sourceMessage.getMessageType() != null
                && sourceMessage.getMessageType().name().startsWith("SYSTEM_")) {
            throw new IllegalArgumentException("Không thể chuyển tiếp tin nhắn hệ thống");
        }
        if (sourceMessage.getMessageType() == MessageType.POLL) {
            throw new IllegalArgumentException("Khong the chuyen tiep binh chon");
        }
    }

    private void validateCanSendToConversation(
            Conversation conversation,
            ConversationMemberResponse senderInfo) {
        if (conversation.isMessageRestricted()
                && senderInfo.getRole() != MemberRole.OWNER
                && senderInfo.getRole() != MemberRole.DEPUTY) {
            throw new AccessDeniedException("Nhóm đang bật chế độ chỉ Trưởng/Phó nhóm mới được gửi tin nhắn.");
        }

        if (conversation.getType() == ConversationType.DIRECT) {
            Long partnerId = conversation.getMembers() == null ? null : conversation.getMembers()
                    .stream()
                    .map(ConversationMember::getUser)
                    .filter(Objects::nonNull)
                    .map(user -> user.getId())
                    .filter(memberUserId -> !memberUserId.equals(senderInfo.getUserId()))
                    .findFirst()
                    .orElse(null);
            if (partnerId != null && (
                    blockUserRepository.existsByBlocker_IdAndBlocked_Id(senderInfo.getUserId(), partnerId)
                            || blockUserRepository.existsByBlocker_IdAndBlocked_Id(partnerId, senderInfo.getUserId()))) {
                throw new AccessDeniedException("Bạn không thể nhắn tin với người này.");
            }
        }
    }

    private Message buildForwardMessage(
            Message sourceMessage,
            Long targetConversationId,
            Long senderId,
            List<String> copiedAttachmentKeys) {
        Message newMessage = new Message();
        newMessage.setContent(sourceMessage.getContent());
        newMessage.setMessageType(sourceMessage.getMessageType());
        newMessage.setSenderId(senderId);
        newMessage.setConversationId(targetConversationId);
        newMessage.setCreatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        newMessage.setAttachments(cloneForwardAttachments(
                sourceMessage.getAttachments(),
                targetConversationId,
                sourceMessage.getMessageType(),
                copiedAttachmentKeys
        ));

        if (isMediaMessage(sourceMessage.getMessageType())
                && (sourceMessage.getAttachments() == null || sourceMessage.getAttachments().isEmpty())
                && sourceMessage.getContent() != null
                && !sourceMessage.getContent().isBlank()) {
            newMessage.setContent(copyForwardMediaKey(
                    sourceMessage.getContent(),
                    targetConversationId,
                    null,
                    sourceMessage.getMessageType(),
                    copiedAttachmentKeys
            ));
        }

        return newMessage;
    }

    private List<Message.MediaAttachment> cloneForwardAttachments(
            List<Message.MediaAttachment> sourceAttachments,
            Long targetConversationId,
            MessageType messageType,
            List<String> copiedAttachmentKeys) {
        if (sourceAttachments == null || sourceAttachments.isEmpty()) {
            return null;
        }

        return sourceAttachments.stream()
                .map(attachment -> Message.MediaAttachment.builder()
                        .url(copyForwardMediaKey(
                                attachment.getUrl(),
                                targetConversationId,
                                attachment.getFileName(),
                                messageType,
                                copiedAttachmentKeys
                        ))
                        .fileName(attachment.getFileName())
                        .fileSize(attachment.getFileSize())
                        .build())
                .collect(Collectors.toList());
    }

    private String copyForwardMediaKey(
            String sourceKey,
            Long targetConversationId,
            String fileName,
            MessageType messageType,
            List<String> copiedAttachmentKeys) {
        String destinationKey = buildForwardObjectKey(targetConversationId, sourceKey, fileName, messageType);
        String copiedKey = s3Service.copyObject(UploadModule.CONVERSATION, sourceKey, destinationKey);
        copiedAttachmentKeys.add(copiedKey);
        return copiedKey;
    }

    private String buildForwardObjectKey(
            Long targetConversationId,
            String sourceKey,
            String fileName,
            MessageType messageType) {
        String extension = resolveExtension(fileName);
        if (extension.isBlank()) {
            extension = resolveExtension(sourceKey);
        }

        String subFolder = switch (Optional.ofNullable(messageType).orElse(MessageType.FILE)) {
            case IMAGE -> "images";
            case VIDEO -> "videos";
            case AUDIO -> "audios";
            default -> "files";
        };

        if (messageType == null && sourceKey != null) {
            String normalized = sourceKey.toLowerCase();
            if (normalized.contains("/images/")) subFolder = "images";
            else if (normalized.contains("/videos/")) subFolder = "videos";
            else if (normalized.contains("/audios/")) subFolder = "audios";
        }

        return String.format(
                "conversations/%s/%s/%s%s",
                targetConversationId,
                subFolder,
                UUID.randomUUID(),
                extension
        );
    }

    private String resolveExtension(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.trim();
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        int fragmentIndex = normalized.indexOf('#');
        if (fragmentIndex >= 0) {
            normalized = normalized.substring(0, fragmentIndex);
        }
        int dotIndex = normalized.lastIndexOf('.');
        int slashIndex = normalized.lastIndexOf('/');
        if (dotIndex <= slashIndex || dotIndex < 0 || dotIndex == normalized.length() - 1) {
            return "";
        }
        return normalized.substring(dotIndex).toLowerCase();
    }

    private boolean isMediaMessage(MessageType type) {
        return type == MessageType.IMAGE
                || type == MessageType.VIDEO
                || type == MessageType.FILE
                || type == MessageType.AUDIO;
    }

    private void deleteCopiedForwardAttachments(List<String> copiedAttachmentKeys) {
        for (String copiedKey : copiedAttachmentKeys) {
            try {
                s3Service.deleteByKey(UploadModule.CONVERSATION, copiedKey);
            } catch (Exception ex) {
                log.warn("Không thể dọn file S3 đã copy khi forward lỗi: {}", copiedKey, ex);
            }
        }
    }

    private record ForwardTargetContext(
            Conversation conversation,
            ConversationMemberResponse senderInfo) {
    }

    private record ForwardPublishPayload(
            Long conversationId,
            MessageResponse messageResponse,
            LastMessageResponse lastMessageResponse) {
    }

    private void createAndPublishSystemMessage(String targetMsgId, Long senderId, Long convId, MessageType type, String content) {
        Conversation conversation = conversationRepository.findById(convId).get();
        ConversationMemberResponse senderInfo = conversationMemberService.getMemberInfo(convId, senderId);

        // Lưu Mongo
        Message systemMsg = new Message();
        systemMsg.setMessageType(type);
        systemMsg.setContent(content);
        systemMsg.setSenderId(senderId);
        systemMsg.setConversationId(convId);
        systemMsg.setCreatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        Message.ReplyInfo replyInfo = buildReplyInfo(targetMsgId);
        systemMsg.setReplyInfo(replyInfo);
        if (replyInfo != null && replyInfo.getType() == MessageType.POLL) {
            messageRepository.findById(replyInfo.getMessageId())
                    .map(Message::getPollId)
                    .ifPresent(systemMsg::setPollId);
        }
        Message savedMsg = messageRepository.save(systemMsg);

        // Map sang Response
        MessageResponse resp = messageMapper.toMessageResponse(savedMsg);

        // Xử lý hệ quả (Sidebar, Redis, MySQL Unread)
        LastMessageResponse sidebarResp = processPostMessageSideEffects(conversation, savedMsg, senderInfo, resp);

        // Phát sự kiện (WebSocket)
        publishMessageEvents(convId, resp, sidebarResp);
    }

    // Hàm dùng để bắn sự kiện cho các kênh đăng ký
    private String getPinnedMessageContent(Message message, boolean isMedia) {
        if (message.getMessageType() == MessageType.POLL) {
            return getSidebarPreview(MessageType.POLL, message.getContent());
        }
        if (isMedia && message.getAttachments() != null && !message.getAttachments().isEmpty()) {
            return message.getAttachments().get(0).getUrl();
        }
        return message.getContent();
    }

    private void publishMessageEvents(Long conversationId, MessageResponse msgResp, LastMessageResponse sidebarResp) {
        // Kênh trong phòng
        this.eventPublisher.publishEvent(new MessageCreatedEvent(msgResp));
        // Kênh Sidebar
        Set<Long> memberIds = this.conversationMemberService.getAllMemberId(conversationId);
        this.eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, sidebarResp, memberIds));
    }


    // Hàm xử lý hệ quả (MySQL, Cache)
    private void enrichAndPublishDirectConversationCreated(Long conversationId, Long senderId, MessageResponse messageResponse) {
        Conversation createdConversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay cuoc tro chuyen"));
        Set<Long> memberIds = this.conversationMemberService.getAllMemberId(conversationId);

        for (Long memberId : memberIds) {
            ConversationResponse conversationResponse = conversationMapper.toConversationResponse(createdConversation, memberId);
            if (conversationResponse.getLastMessage() != null
                    && conversationResponse.getLastMessage().getLastSenderId() != null
                    && conversationResponse.getLastMessage().getLastSenderId().equals(memberId)) {
                conversationResponse.getLastMessage().setRead(true);
            }
            if (memberId.equals(senderId)) {
                messageResponse.setConversation(conversationResponse);
                messageResponse.setNewConversation(true);
            }
            eventPublisher.publishEvent(new ConversationCreatedEvent(conversationResponse, Collections.singleton(memberId)));
        }
    }

    private LastMessageResponse processPostMessageSideEffects(
            Conversation conversation, Message savedMessage,
            ConversationMemberResponse senderInfo, MessageResponse messageResponse) {

        // Lưu vào redis cache (giúp lần sau load nhanh hơn, tiết kiệm thời gian phải truy vấn xuống db)
        TransactionUtil.executeAfterCommit(() -> {
            messageCacheService.cacheNewMessage(messageResponse);
        });

        // Cập nhật trạng thái phòng khi người dùng nhắn tin (gồm tin nhắn mới nhất, người nhắn, thời gian)
        String sidebarPreview = truncateSidebarPreview(
                getSidebarPreview(savedMessage.getMessageType(), savedMessage.getContent())
        );
        conversation.setLastMessageId(savedMessage.getId());
        conversation.setLastMessageContent(sidebarPreview);
        conversation.setLastMessageAt(savedMessage.getCreatedAt());
        conversation.setLastSenderId(savedMessage.getSenderId());
        conversation.setLastSenderName(senderInfo.getNickname());

        // Snapshot sidebar dùng type tương thích DB cũ; nội dung vẫn thể hiện cuộc gọi rõ ràng.
        MessageType sidebarMessageType = savedMessage.getMessageType() == MessageType.CALL
                ? MessageType.TEXT
                : savedMessage.getMessageType();
        conversation.setLastMessageType(sidebarMessageType);
        Conversation savedConversation = this.conversationRepository.save(conversation);

        // Tăng unreadCount cho các thành viên khác trong DB
        conversationMemberRepository.incrementUnreadCount(savedConversation.getId(), senderInfo.getUserId());
        // Reset isHidden về false cho tất cả members (để conversation hiện lại nếu đã bị ẩn)
        conversationMemberRepository.unhideConversationForAllMembers(savedConversation.getId());

        // 4. Build Sidebar Response
        LastMessageResponse lastMessageResponse = this.conversationMapper.toLastMessageResponse(savedConversation);
        lastMessageResponse.setLastSenderName(senderInfo.getNickname());
        lastMessageResponse.setRead(false);

        return lastMessageResponse;
    }

    // Lay ra duoc thong tin neu day la tin nhan phan hoi
    private Message.ReplyInfo buildReplyInfo(String replyToId) {
        if (replyToId == null || replyToId.trim().isEmpty()) {
            return null;
        }
        String previewContent ;
        Message originalMsg = this.messageRepository.findById(replyToId)
                .orElseThrow(() -> new RuntimeException("Tin nhan goc khong ton tai"));
        if(originalMsg.getAttachments() != null){
            previewContent = originalMsg.getAttachments().getFirst().getUrl();
        }else {
            previewContent = originalMsg.getContent();
        }

        if (previewContent != null && previewContent.length() > 50 && originalMsg.getMessageType() == MessageType.TEXT) {
            previewContent = previewContent.substring(0, 47) + "...";
        }

        return Message.ReplyInfo.builder()
                .messageId(originalMsg.getId())
                .senderId(originalMsg.getSenderId())
                .type(originalMsg.getMessageType())
                .content(previewContent)
                .build();
    }

    private List<Message.MediaAttachment> mapAttachments(List<SendMessageRequest.AttachmentRequest> reqs) {
        if (reqs == null) return null;
        return reqs.stream().map(r -> Message.MediaAttachment.builder()
                .url(r.getUrl()).fileName(r.getFileName()).fileSize(r.getFileSize())
                .build()).collect(Collectors.toList());
    }

    private String normalizeClientMessageId(String clientMessageId) {
        if (clientMessageId == null) return null;
        String trimmed = clientMessageId.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > 100 ? trimmed.substring(0, 100) : trimmed;
    }

    private void handleUnpinOnRecall(Conversation conversation, String messageId, Long userId) {
        List<PinnedMessageDetail> pinnedList = conversation.getPinnedMessages();
        if (pinnedList != null && pinnedList.removeIf(p -> p.getMessageId().equals(messageId))) {
            conversation.setPinnedMessages(pinnedList);
            conversationRepository.save(conversation);
            createAndPublishSystemMessage(null, userId, conversation.getId(), MessageType.SYSTEM_UPIN, "đã tự động bỏ ghim do tin nhắn bị thu hồi");
            eventPublisher.publishEvent(new PinUpdatedEvent(conversation.getId(), pinnedList));
        }
    }

    private void closePollOnRecall(Message message) {
        if (message.getMessageType() != MessageType.POLL || message.getPollId() == null) {
            return;
        }
        pollRepository.findById(message.getPollId()).ifPresent(poll -> {
            poll.setClosed(true);
            poll.setRecalled(true);
            poll.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
            Poll savedPoll = pollRepository.save(poll);
            TransactionUtil.executeAfterCommit(() -> {
                PollResponse pollResponse = pollMapper.toResponse(savedPoll, null);
                pollCacheService.cachePoll(pollResponse);
            });
            eventPublisher.publishEvent(new iuh.fit.edu.backend.modules.chat.event.payload.PollUpdatedEvent(
                    pollMapper.toResponse(savedPoll, null)
            ));
        });
    }

    private void deleteS3Attachments(List<Message.MediaAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return;
        for (Message.MediaAttachment attachment : attachments) {
            try {
                this.s3Service.deleteByKey(UploadModule.CONVERSATION, attachment.getUrl());
            } catch (Exception e) {
                log.error("Không thể xóa file S3 khi thu hồi: {}", attachment.getUrl(), e);
            }
        }
    }

    private void updateSidebarIfLastMessage(Message message, Conversation conversation, Long userId) {
        if (message.getCreatedAt().toEpochMilli() == conversation.getLastMessageAt().toEpochMilli()) {

            // Cập nhật Database MySQL
            // Backend lưu 1 chuỗi chung chung, không chứa chữ "Bạn"
            conversation.setLastMessageContent("Tin nhắn đã được thu hồi");
            // Quan trọng: Vẫn giữ nguyên LastSenderId là của người vừa thu hồi
            conversationRepository.save(conversation);

            // Tạo Data để bắn Socket cho Sidebar
            LastMessageResponse sidebarResponse = conversationMapper.toLastMessageResponse(conversation);

            // Lấy tên người gửi (có thể lấy từ Service hoặc Cache nếu cần thiết)
            // Nếu Frontend của bạn không hiện tên khi thu hồi thì có thể bỏ qua dòng setLastSenderName
            ConversationMemberResponse senderInfo = conversationMemberService.getMemberInfo(conversation.getId(), userId);
            sidebarResponse.setLastSenderName(senderInfo.getNickname());
            sidebarResponse.setRead(true);

            // Bắn Socket Event Cập nhật Sidebar cho TẤT CẢ thành viên
            Set<Long> memberIds = this.conversationMemberService.getAllMemberId(conversation.getId());
            this.eventPublisher.publishEvent(new ConversationUpdatedEvent(conversation.getId(), sidebarResponse, memberIds));
        }
    }

    /**
     * Format nội dung hiển thị ở danh sách Chat bên ngoài
     */
    private String getSidebarPreview(MessageType type, String content) {
        if (type == null)
            return content;

        return switch (type) {
            case IMAGE -> "[Hình ảnh]";
            case VIDEO -> "[Video]";
            case FILE -> "[Tệp đính kèm]";
            case AUDIO -> "[Tin nhắn thoại]";
            case CALL -> getCallPreview(content);
            case POLL -> "[Binh chon] " + Optional.ofNullable(content).orElse("");
            case SYSTEM_POLL_CREATED -> "Da tao cuoc binh chon: " + Optional.ofNullable(content).orElse("");
            case SYSTEM_POLL_VOTED -> "Da tham gia cuoc binh chon: " + Optional.ofNullable(content).orElse("");
            case SYSTEM_POLL_CHANGED -> "Da doi lua chon trong cuoc binh chon: " + Optional.ofNullable(content).orElse("");
            case SYSTEM_POLL_CLOSED -> "Da khoa binh chon: " + Optional.ofNullable(content).orElse("");
            case SYSTEM_POLL_PINNED -> "Da ghim binh chon: " + Optional.ofNullable(content).orElse("");
            case SYSTEM_PIN -> "Đã ghim một tin nhắn";
            case SYSTEM_UPIN -> "Đã bỏ ghim một tin nhắn";
            case TEXT -> content; // Text thì in ra bình thường
            default -> "Đã gửi một tin nhắn";
        };
    }

    private String truncateSidebarPreview(String content) {
        if (content == null || content.length() <= SIDEBAR_PREVIEW_MAX_LENGTH) {
            return content;
        }
        return content.substring(0, SIDEBAR_PREVIEW_MAX_LENGTH - 3) + "...";
    }

    private String getCallPreview(String content) {
        try {
            Map<String, Object> payload = objectMapper.readValue(
                    content, new TypeReference<>() {
                    }
            );
            String callType = String.valueOf(payload.getOrDefault("callType", "audio")).toLowerCase();
            Object durationObj = payload.getOrDefault("durationSeconds", 0);
            Number durationSecondsRaw = durationObj instanceof Number ? (Number) durationObj : 0;
            long durationSeconds = Math.max(0, durationSecondsRaw.longValue());

            String text = "video".equals(callType) ? "Cuộc gọi video" : "Cuộc gọi thoại";
            return text + " - " + formatDuration(durationSeconds);
        } catch (Exception e) {
            return "Cuộc gọi";
        }
    }

    private String formatDuration(long totalSeconds) {
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        return String.format("%02d:%02d", minutes, seconds);
    }

    private String buildCallMessageContent(SendCallMessageRequest sendCallMessageRequest) {
        Map<String, Object> payload = new HashMap<>();
        payload.put(
                "callType",
                Optional.ofNullable(sendCallMessageRequest.getCallType()).orElse("audio").toLowerCase()
        );
        payload.put("status", Optional.ofNullable(sendCallMessageRequest.getStatus()).orElse("ended").toLowerCase());
        payload.put(
                "durationSeconds",
                Math.max(0, Optional.ofNullable(sendCallMessageRequest.getDurationSeconds()).orElse(0L))
        );

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Không thể tạo nội dung cuộc gọi", e);
        }
    }

    // =======================================================
    // PRIVATE HELPERS CHO TÍNH NĂNG XÓA 1 PHÍA
    // =======================================================
    private void markMessageAsDeletedForUser(Message message, Long userId) {
        if (message.getDeletedFor() == null) {
            message.setDeletedFor(new HashSet<>());
        }
        message.getDeletedFor().add(userId);
        messageRepository.save(message);

        TransactionUtil.executeAfterCommit(() -> {
            this.messageCacheService.addDeletedUserToMessage(message.getId(), message.getConversationId(), userId);
        });
    }

    private void handleOverrideMaskForSidebar(Long conversationId, String deletedMessageId, Long userId) {
        Conversation conv = conversationRepository.findById(conversationId).orElse(null);

        // Chỉ kích hoạt mặt nạ nếu tin nhắn vừa xóa đúng là tin mới nhất của nhóm
        if (conv == null || !deletedMessageId.equals(conv.getLastMessageId())) {
            return;
        }

        ConversationMember member = conversationMemberRepository
                .findByConversation_IdAndUser_IdAndStatus(conv.getId(), userId, ConversationMemberStatus.ACTIVE)
                .orElse(null);

        if (member != null) {
            FrozenLastMessage personalLastMsg = buildPersonalLastMessageMask(conv, userId, Instant.now().truncatedTo(ChronoUnit.MILLIS));

            // Cập nhật vào DB
            member.setHiddenGlobalMessageId(deletedMessageId);
            member.setPersonalLastMessage(personalLastMsg);
            conversationMemberRepository.save(member);

            // Bắn sự kiện cập nhật Sidebar cho riêng người dùng này
            publishPersonalSidebarUpdate(conv.getId(), userId, personalLastMsg);
        }
    }

    private FrozenLastMessage buildPersonalLastMessageMask(Conversation conv, Long userId, Instant fallbackTime) {
        Message previousMsg = messageRepository.findFirstByConversationIdAndDeletedForNotOrderByCreatedAtDesc(conv.getId(), userId);
        FrozenLastMessage mask = new FrozenLastMessage();

        if (previousMsg != null) {
            mask.setContent(getSidebarPreview(previousMsg.getMessageType(), previousMsg.getContent()));
            mask.setType(previousMsg.getMessageType());
            mask.setTime(previousMsg.getCreatedAt());
            mask.setSenderId(previousMsg.getSenderId());

            String displayName = chatSnapshotHelper.resolveActorDisplayName(conv, previousMsg.getSenderId());
            mask.setSenderName(displayName);

            mask.setSenderName(displayName);
        } else {
            mask.setContent("Không có tin nhắn");
            mask.setTime(fallbackTime);
        }

        return mask;
    }

    private void publishPersonalSidebarUpdate(Long conversationId, Long userId, FrozenLastMessage personalLastMsg) {
        LastMessageResponse sidebarUpdate = new LastMessageResponse();
        sidebarUpdate.setLastMessageContent(personalLastMsg.getContent());
        sidebarUpdate.setLastMessageType(personalLastMsg.getType());
        sidebarUpdate.setLastMessageAt(personalLastMsg.getTime());
        sidebarUpdate.setLastSenderId(personalLastMsg.getSenderId());
        sidebarUpdate.setLastSenderName(personalLastMsg.getSenderName());
        sidebarUpdate.setRead(true); // Quan trọng: Đánh dấu đã đọc

        Set<Long> notifyOnlyMe = Collections.singleton(userId);
        eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, sidebarUpdate, notifyOnlyMe));
    }



}
