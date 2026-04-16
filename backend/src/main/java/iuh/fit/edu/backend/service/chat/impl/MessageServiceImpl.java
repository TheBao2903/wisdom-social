/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.chat.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.constant.MessageType;
import iuh.fit.edu.backend.constant.UploadModule;
import iuh.fit.edu.backend.domain.entity.mysql.Conversation;
import iuh.fit.edu.backend.domain.entity.mysql.PinnedMessageDetail;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.domain.entity.nosql.Message;
import iuh.fit.edu.backend.dto.request.SendCallMessageRequest;
import iuh.fit.edu.backend.dto.response.message.MessageRecalledResponse;
import iuh.fit.edu.backend.event.payload.ConversationUpdatedEvent;
import iuh.fit.edu.backend.event.payload.MessageCreatedEvent;
import iuh.fit.edu.backend.dto.request.message.SendMessageRequest;
import iuh.fit.edu.backend.dto.response.CursorResponse;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import iuh.fit.edu.backend.dto.response.message.LastMessageResponse;
import iuh.fit.edu.backend.dto.response.message.MessageResponse;
import iuh.fit.edu.backend.event.payload.MessageRecalledEvent;
import iuh.fit.edu.backend.event.payload.PinUpdatedEvent;
import iuh.fit.edu.backend.mapper.ConversationMapper;
import iuh.fit.edu.backend.mapper.MessageMapper;
import iuh.fit.edu.backend.repository.mysql.ConversationMemberRepository;
import iuh.fit.edu.backend.repository.mysql.ConversationRepository;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import iuh.fit.edu.backend.repository.nosql.MessageRepository;
import iuh.fit.edu.backend.service.chat.ConversationMemberService;
import iuh.fit.edu.backend.service.chat.MessageCacheService;
import iuh.fit.edu.backend.service.chat.MessageService;
import iuh.fit.edu.backend.service.s3.S3Service;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Service
@AllArgsConstructor
public class MessageServiceImpl implements MessageService {
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConversationMemberService conversationMemberService;
    private final ApplicationEventPublisher eventPublisher;
    private final MessageMapper messageMapper;
    private final ConversationRepository conversationRepository;
    private final ConversationMapper conversationMapper;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageCacheService messageCacheService;
    private final S3Service s3Service;
    private final ObjectMapper objectMapper;
    private final MongoTemplate mongoTemplate;

    /**
     * Hàm xử lý việc gửi tin nhắn
     */
    @Override
    @Transactional
    public MessageResponse sendMessage(SendMessageRequest sendMessageRequest, Long userId) {
        // Kiểm tra phòng còn tồn tại hay không
        Conversation conversation = this.conversationRepository.findById(sendMessageRequest.getConversationId())
                .orElseThrow(() -> new RuntimeException("Không tim thấy cuộc trò chuyện"));

        // Lấy ra thông tin của người gửi (lần đầu tiên thì lấy từ db, những lần khác còn trong thời gian thì lấy từ redis cache)
        ConversationMemberResponse senderInfo = conversationMemberService
                .getMemberInfo(sendMessageRequest.getConversationId(), userId);

        // Lưu tin nhắn vào mongo
        Message newMessage = new Message();
        newMessage.setContent(sendMessageRequest.getContent());
        newMessage.setMessageType(sendMessageRequest.getType());
        newMessage.setSenderId(senderInfo.getUserId());
        newMessage.setConversationId(sendMessageRequest.getConversationId());
        newMessage.setCreatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        newMessage.setReplyInfo(buildReplyInfo(sendMessageRequest.getReplyToId()));
        newMessage.setAttachments(mapAttachments(sendMessageRequest.getAttachments()));

        Message savedMessage = messageRepository.save(newMessage);

        // Tạo full response cho người đang chat
        MessageResponse messageResponse = this.messageMapper.toMessageResponse(savedMessage);


        // XỬ LÝ SIDE EFFECTS (CÁC TÁC VỤ PHỤ)
        LastMessageResponse lastMessageResponse = processPostMessageSideEffects(
                conversation, savedMessage, senderInfo, messageResponse
        );

        // Ban su kien gui tin nhan di cho cac noi dang ky
        publishMessageEvents(conversation.getId(), messageResponse, lastMessageResponse);

        return messageResponse;
    }

    /**
     * Hàm xử lý việc ghim tin nhắn
     */
    @Override
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

        // Thêm tin mới vào danh sách ghim
        pinnedList.add(new PinnedMessageDetail(messageId, userId, Instant.now().truncatedTo(ChronoUnit.MILLIS)));

        // Gán list mới để Hibernate detect dirty cho cột JSON pin list
        conversation.setPinnedMessages(pinnedList);
        conversationRepository.save(conversation);

        // Tạo tin nhắn hệ thống thông báo "Đã ghim"
        // User sẽ thấy: "{user_name} đã ghim một tin nhắn"
        createAndPublishSystemMessage(
                messageId, userId, conversationId,
                MessageType.SYSTEM_PIN, "đã ghim một tin nhắn"
        );

        // Bắn event cập nhật danh sách ghim trên Header cho tất cả members
        eventPublisher.publishEvent(new PinUpdatedEvent(conversationId, pinnedList));
    }

    /**
     * Hàm xử lý việc bỏ ghim tin nhắn
     */
    @Override
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

    /**
     * Hàm xử lý việc gọi
     */
    @Override
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
    @Override
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
        // Xóa file trên s3
        deleteS3Attachments(message.getAttachments());

        message.setAttachments(null);
        message.setContent("");
        message.setRecalled(true);
        this.messageRepository.save(message);

        // Cập nhật lại các tin nhắn reply lại tin nhắn đang thu hồi
        messageRepository.updateContentOfRepliedMessages(messageId);



        MessageRecalledResponse messageRecalledResponse = new MessageRecalledResponse(message.getId(), message.getConversationId(), message.getCreatedAt());
        // Cập nhật Redis cache để tránh trả về tin nhắn cũ
        messageCacheService.updateMessage(messageRecalledResponse);

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
    @Override
    public void deleteMessageForMe(String messageId, Long userId) {
        Message message = this.messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));

        if (message.getDeletedFor() == null) {
            message.setDeletedFor(new HashSet<>());
        }
        message.getDeletedFor().add(userId);
        messageRepository.save(message);
        this.messageCacheService.addDeletedUserToMessage(messageId, message.getConversationId(), userId);
    }

    /**
     * Lấy ra tin nhắn trong cuộc hội thoại
     * Mặc định limit = 20
     */
    @Override
    public CursorResponse<List<MessageResponse>> getMessagesByConversation(
            Long conversationId,
            Long userId,
            Instant before,
            int limit
    ) {
        ConversationMemberResponse member = conversationMemberService.getMemberInfo(conversationId, userId);

        Instant clearedAt = member.getClearedAt();
        // =========================================================================
        // Nếu FE yêu cầu load trang cũ hơn mốc user đã xóa -> Chắc chắn rỗng.
        // Trả về ngay lập tức, KHÔNG chạm vào Redis, KHÔNG chạm vào Mongo!
        // =========================================================================
        if (clearedAt != null && before != null && before.toEpochMilli() <= clearedAt.toEpochMilli()) {
            return CursorResponse.<List<MessageResponse>>builder()
                    .data(Collections.emptyList())
                    .nextCursor(null)
                    .hasMoreOlder(false) // Không còn tin cũ
                    .hasMoreNewer(false)
                    .build();
        }
        List<MessageResponse> finalResponseList;

        // Cần check để xem được lấy từ db hay redis
        // Vì cách check hasNext ở db và redis sẽ khác nhau
        boolean isFromCache = false;
        log.info("Fetch messages before Instant: {}", before);

        // Ưu tiên lấy từ redis trước (bao gồm cả việc load trang đầu hoặc khi scroll)
        List<MessageResponse> cachedMessages = this.messageCacheService.getListMessage(conversationId, before, limit);
        if (!cachedMessages.isEmpty()) {
            log.info("List message from cache {}", cachedMessages);
            finalResponseList = cachedMessages;
            isFromCache = true;
        } else {
            // Lấy dư 1 để check hasNext
            List<Message> mongoMessages = fetchMessagesFromDb(conversationId, before, limit + 1);
            log.info("List message from mongo {}", mongoMessages.size());

            finalResponseList = mongoMessages.stream()
                    .map(messageMapper::toMessageResponse)
                    .collect(Collectors.toList());

            // Chỉ cache phần dữ liệu chính (bỏ phần tử dư dùng check hasNext)
            List<MessageResponse> toCache = finalResponseList.size() > limit
                    ? finalResponseList.subList(0, limit)
                    : finalResponseList;

            // Tự động quyết định ghi đè hay nối chuỗi
            this.messageCacheService.cacheListMessage(conversationId, toCache, before);
        }
        boolean hasMoreOlder;
        if (isFromCache) {
            // Nếu redis trả về >= 20 tin -> giả định là vẫn còn tin nhắn cũ
            // Nếu redis trả về < 20 tin (VD: 15) -> chắc chắn là hết tin nhắn
            hasMoreOlder = finalResponseList.size() >= limit;
        } else {
            // Nếu db trả về > 20 (VD: 21) -> chắc chắn vẫn còn tin nhắn cũ
            hasMoreOlder = finalResponseList.size() > limit;
            if (hasMoreOlder) {
                finalResponseList = finalResponseList.subList(0, limit);
            }
        }
        // Cursor là createdAt của tin nhắn CŨ NHẤT trong list (tin cuối cùng của list DESC)
        Instant nextCursor = null;
        if (!finalResponseList.isEmpty()) {
            nextCursor = finalResponseList.getLast().getCreatedAt();
        }
        if (clearedAt != null && nextCursor != null && nextCursor.toEpochMilli() <= clearedAt.toEpochMilli()) {
            // Mặc dù hệ thống chung vẫn còn tin nhắn cũ, nhưng đối với User này thì coi như hết!
            hasMoreOlder = false;
            nextCursor = null;
        }

        List<MessageResponse> filteredList = finalResponseList.stream()
                .filter(msg -> clearedAt == null || msg.getCreatedAt().toEpochMilli() > clearedAt.toEpochMilli())
                .filter(msg -> msg.getDeletedFor() == null || !msg.getDeletedFor().contains(userId))
                .toList();

        // Đảo ngược danh sách để Frontend hiển thị từ trên xuống (Cũ -> Mới)
        List<MessageResponse> ascResponseList = new ArrayList<>(filteredList);
        Collections.reverse(ascResponseList);

        // Lấy ra thông tin của những người đã rời khỏi nhóm
        Map<Long, CursorResponse.UserReferenceDTO> referenceUsers = buildReferenceUsers(conversationId, ascResponseList);

        ascResponseList.forEach(msg -> msg.setDeletedFor(null));


        log.info(
                "Final List message returned to user. Size: {}, Data: {}",
                ascResponseList.size(),
                ascResponseList
        );

        return CursorResponse.<List<MessageResponse>>builder()
                .data(ascResponseList)
                .nextCursor(nextCursor)
                .hasMoreOlder(hasMoreOlder)
                .hasMoreNewer(false)
                .referenceUsers(referenceUsers)
                .build();
    }

    @Override
    public CursorResponse<List<MessageResponse>> getNewerMessages(
            Long conversationId, Long userId, Instant after, int limit) {

        // Kiểm tra quyền
        conversationMemberService.getMemberInfo(conversationId, userId);

        // Truy vấn MongoDB lấy dữ liệu mới hơn (Lấy dư 1 để check hasNext)
        List<Message> mongoMessages = messageRepository
                .findTop21ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(conversationId, after);

        // Phân trang (Check còn dữ liệu mới hơn nữa không)
        boolean hasMoreNewer = mongoMessages.size() > limit;
        if (hasMoreNewer) {
            mongoMessages = mongoMessages.subList(0, limit);
        }

        // 4. Map sang DTO
        List<MessageResponse> responseList = mongoMessages.stream()
                .map(messageMapper::toMessageResponse)
                .collect(Collectors.toList());

        // Xác định nextCursor cho lần cuộn xuống tiếp theo (Là phần tử cuối mảng)
        Instant nextCursor = responseList.isEmpty() ? null : responseList.getLast().getCreatedAt();

        // Đắp Side-loading (Người đã rời nhóm)
        Map<Long, CursorResponse.UserReferenceDTO> referenceUsers = buildReferenceUsers(conversationId, responseList);
        responseList.forEach(msg -> msg.setDeletedFor(null));


        return CursorResponse.<List<MessageResponse>>builder()
                .data(responseList)
                .nextCursor(nextCursor)
                .hasMoreOlder(true)        // Đang lơ lửng ở quá khứ tiến lên, nên chắc chắn phía trên còn tin cũ
                .hasMoreNewer(hasMoreNewer) // Còn tin mới hơn không?
                .referenceUsers(referenceUsers)
                .build();
    }
    /**
     * Hàm xử lý việc nhảy tin nhắn (khi người dùng click vào tin nhắn phản hồi và tin nhắn ghim)
     */
    @Override
    public CursorResponse<List<MessageResponse>> jumpToMessage(Long conversationId, String targetMessageId, Long userId) {
        log.info("Jump to message");
        ConversationMemberResponse member = conversationMemberService.getMemberInfo(conversationId, userId);

        List<MessageResponse> resultList;
        boolean hasMoreOlder = false;
        boolean hasMoreNewer = false;
        // Kiểm tra xem có nằm trong redis không (nếu có thì sẽ lấy ra luôn)
        List<MessageResponse> cacheMessages = messageCacheService.getJumpMessagesFromCache(conversationId, targetMessageId);

        if (!cacheMessages.isEmpty()) {
            log.info("Jump mode: List message from redis {}", targetMessageId);
            resultList = new ArrayList<>(cacheMessages);
            Collections.reverse(resultList);
            hasMoreOlder = true;  // Vẫn còn lịch sử trong DB để cuộn lên
            hasMoreNewer = false;
        } else {
            // Chuyển qua lấy từ db
            Message targetMsg = messageRepository.findById(targetMessageId)
                    .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));


            // Tin cũ sẽ lấy ra 11 dữ liệu để kiểm tra xem còn dữ liệu cũ hơn nữa không
            List<Message> older = messageRepository.findTop11ByConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(
                    conversationId, targetMsg.getCreatedAt());
            List<Message> newer = messageRepository.findTop11ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(
                    conversationId, targetMsg.getCreatedAt());

            // Kiểm tra xem còn dư dữ liệu không
            hasMoreOlder = older.size() > 10;
            if (hasMoreOlder) {
                older = older.subList(0, 10);
            }

            hasMoreNewer = newer.size() > 10;
            if (hasMoreNewer) {
                newer = newer.subList(0, 10);
            }

            resultList = new ArrayList<>();

            // Nạp tin cũ (đảo ngược để đúng chiều thời gian)
            List<MessageResponse> olderDtos = older.stream().map(messageMapper::toMessageResponse).toList();
            for (int i = olderDtos.size() - 1; i >= 0; i--)
                resultList.add(olderDtos.get(i));

            // Nạp tin mới
            resultList.add(messageMapper.toMessageResponse(targetMsg));

            // Nạp tin gốc
            resultList.addAll(newer.stream().map(messageMapper::toMessageResponse).toList());
        }

        // Xử lý thông tin của những người đã rời khỏi nhóm
        Map<Long, CursorResponse.UserReferenceDTO> referenceUsers = buildReferenceUsers(conversationId, resultList);

        // Xóa cờ deletedFor trước khi trả về
        resultList.forEach(msg -> msg.setDeletedFor(null));

        return CursorResponse.<List<MessageResponse>>builder()
                .data(resultList)
                .hasMoreOlder(hasMoreOlder)
                .hasMoreNewer(hasMoreNewer)
                .referenceUsers(referenceUsers) // Đắp từ điển vào Response
                .build();
    }


    // Hàm dùng để lấy ra thông tin của những người đã rời khỏi cuộc trò chuyện
    private Map<Long, CursorResponse.UserReferenceDTO> buildReferenceUsers(
            Long conversationId,
            List<MessageResponse> messages) {

        Map<Long, CursorResponse.UserReferenceDTO> referenceUsers = new HashMap<>();
        Map<Long, ConversationMemberResponse> currentMembers = conversationMemberService.getMembersMap(conversationId);

        // Quét tìm những ID có gửi tin nhắn nhưng không nằm trong danh sách Member hiện tại
        Set<Long> missingSenderIds = messages.stream()
                .map(MessageResponse::getSenderId)
                .filter(id -> id != null && !currentMembers.containsKey(id)) // Thêm check null cho chắc chắn
                .collect(Collectors.toSet());

        // Nếu có ai đó bị thiếu, query bảng User gốc để lấy Tên và Avatar của họ bù vào
        if (!missingSenderIds.isEmpty()) {
            List<User> leftUsers = userRepository.findAllById(missingSenderIds);
            leftUsers.forEach(u -> referenceUsers.put(
                    u.getId(),
                    new CursorResponse.UserReferenceDTO(u.getName(), u.getAvatarUrl())
            ));
        }

        return referenceUsers;
    }

    /**
     * Dùng để lấy dữ liệu từ db
     * Không có before thì sẽ lấy 20 tin nhắn đầu
     * Có before thì sẽ lấy tin nhắn cũ hơn
     */
    private List<Message> fetchMessagesFromDb(Long conversationId, Instant before, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        if (before == null) {
            return messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable);
        } else {
            return messageRepository.findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
                    conversationId, before, pageable);
        }
    }

    //  HÀM TẠO TIN NHẮN HỆ THỐNG VÀ CẬP NHẬT SIDEBAR
    private void createAndPublishSystemMessage(String targetMsgId, Long senderId, Long convId, MessageType type, String content) {
        Conversation conversation = conversationRepository.findById(convId).get();
        ConversationMemberResponse senderInfo = conversationMemberService.getMemberInfo(convId, senderId);

        // 1. Lưu Mongo
        Message systemMsg = new Message();
        systemMsg.setMessageType(type);
        systemMsg.setContent(content);
        systemMsg.setSenderId(senderId);
        systemMsg.setConversationId(convId);
        systemMsg.setCreatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
        systemMsg.setReplyInfo(buildReplyInfo(targetMsgId));
        Message savedMsg = messageRepository.save(systemMsg);

        // 2. Map sang Response
        MessageResponse resp = messageMapper.toMessageResponse(savedMsg);

        // 3. Xử lý hệ quả (Sidebar, Redis, MySQL Unread)
        LastMessageResponse sidebarResp = processPostMessageSideEffects(conversation, savedMsg, senderInfo, resp);

        // 4. Phát tán sự kiện (WebSocket)
        publishMessageEvents(convId, resp, sidebarResp);
    }

    // Hàm dùng để bắn sự kiện cho các kênh đăng ký
    private void publishMessageEvents(Long conversationId, MessageResponse msgResp, LastMessageResponse sidebarResp) {
        // Kênh trong phòng
        this.eventPublisher.publishEvent(new MessageCreatedEvent(msgResp));
        // Kênh Sidebar
        Set<Long> memberIds = this.conversationMemberService.getAllMemberId(conversationId);
        this.eventPublisher.publishEvent(new ConversationUpdatedEvent(conversationId, sidebarResp, memberIds));
    }


    // Hàm xử lý hệ quả (MySQL, Cache)
    private LastMessageResponse processPostMessageSideEffects(
            Conversation conversation, Message savedMessage,
            ConversationMemberResponse senderInfo, MessageResponse messageResponse) {

        // Lưu vào redis cache (giúp lần sau load nhanh hơn, tiết kiệm thời gian phải truy vấn xuống db)
        messageCacheService.cacheNewMessage(messageResponse);

        // Cập nhật trạng thái phòng khi người dùng nhắn tin (gồm tin nhắn mới nhất, người nhắn, thời gian)
        String sidebarPreview = getSidebarPreview(savedMessage.getMessageType(), savedMessage.getContent());
        conversation.setLastMessageContent(sidebarPreview);
        conversation.setLastMessageAt(savedMessage.getCreatedAt());
        conversation.setLastSenderId(savedMessage.getSenderId());

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



    private void handleUnpinOnRecall(Conversation conversation, String messageId, Long userId) {
        List<PinnedMessageDetail> pinnedList = conversation.getPinnedMessages();
        if (pinnedList != null && pinnedList.removeIf(p -> p.getMessageId().equals(messageId))) {
            conversation.setPinnedMessages(pinnedList);
            conversationRepository.save(conversation);
            createAndPublishSystemMessage(null, userId, conversation.getId(), MessageType.SYSTEM_UPIN, "đã tự động bỏ ghim do tin nhắn bị thu hồi");
            eventPublisher.publishEvent(new PinUpdatedEvent(conversation.getId(), pinnedList));
        }
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
            ConversationMemberResponse senderInfo = conversationMemberService.getMemberInfo(
                    conversation.getId(),
                    userId
            );
            sidebarResponse.setLastSenderName(senderInfo.getNickname());
            sidebarResponse.setRead(true);

            // Bắn Socket Event Cập nhật Sidebar cho TẤT CẢ thành viên
            Set<Long> memberIds = this.conversationMemberService.getAllMemberId(conversation.getId());
            this.eventPublisher
                    .publishEvent(new ConversationUpdatedEvent(conversation.getId(), sidebarResponse, memberIds));
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
            case SYSTEM_PIN -> "Đã ghim một tin nhắn";
            case SYSTEM_UPIN -> "Đã bỏ ghim một tin nhắn";
            case TEXT -> content; // Text thì in ra bình thường
            default -> "Đã gửi một tin nhắn";
        };
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


}
