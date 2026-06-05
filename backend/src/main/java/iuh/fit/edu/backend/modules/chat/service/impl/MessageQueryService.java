/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service.impl;

import iuh.fit.edu.backend.common.dto.response.CursorResponse;
import iuh.fit.edu.backend.common.util.MediaUrlBuilder;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.chat.entity.Message;
import iuh.fit.edu.backend.modules.conversation.dto.response.ConversationMemberResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageSearchResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageSearchResult;
import iuh.fit.edu.backend.modules.chat.dto.response.ConversationMediaItem;
import iuh.fit.edu.backend.modules.chat.dto.response.ConversationMediaResponse;
import iuh.fit.edu.backend.modules.chat.mapper.MessageMapper;
import iuh.fit.edu.backend.modules.chat.repository.MessageRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberService;
import iuh.fit.edu.backend.modules.chat.service.MessageCacheService;
import iuh.fit.edu.backend.modules.chat.service.PollService;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageQueryService {
    private final MessageRepository messageRepository;
    private final ConversationMemberService conversationMemberService;
    private final MessageCacheService messageCacheService;
    private final MessageMapper messageMapper;
    private final PollService pollService;
    private final MongoTemplate mongoTemplate;
    private final UserService userService;
    private final MediaUrlBuilder mediaUrlBuilder;
    private static final Pattern URL_PATTERN = Pattern.compile("(https?://\\S+|www\\.\\S+)", Pattern.CASE_INSENSITIVE);

    public MessageResponse getMessageById(String messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        conversationMemberService.getMemberInfo(message.getConversationId(), userId);
        if (message.getDeletedFor() != null && message.getDeletedFor().contains(userId)) {
            throw new RuntimeException("Không thể tìm thấy tin nhắn");
        }

        MessageResponse response = messageMapper.toMessageResponse(message);
        enrichPoll(response, userId);
        response.setDeletedFor(null);
        return response;
    }

    /**
     * Lấy ra tin nhắn trong cuộc hội thoại
     * Mặc định limit = 20
     */
    public CursorResponse<List<MessageResponse>> getMessagesByConversation(
            Long conversationId,
            Long userId,
            Instant before,
            int limit
    ) {
        ConversationMemberResponse member = conversationMemberService.getMemberInfo(conversationId, userId);
        Instant clearedAt = member.getClearedAt();

        // Nếu FE yêu cầu load trang cũ hơn mốc user đã xóa -> Chắc chắn rỗng.
        // Trả về ngay lập tức, KHÔNG chạm vào Redis, KHÔNG chạm vào Mongo!
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

        // Nếu redis trả về >= 20 tin -> giả định là vẫn còn tin nhắn cũ
        // Nếu redis trả về < 20 tin (VD: 15) -> chắc chắn là hết tin nhắn
        // Nếu db trả về > 20 (VD: 21) -> chắc chắn vẫn còn tin nhắn cũ
        boolean hasMoreOlder = isFromCache ? finalResponseList.size() >= limit : finalResponseList.size() > limit;
        if (!isFromCache && hasMoreOlder) {
            finalResponseList = finalResponseList.subList(0, limit);
        }

        // Cursor là createdAt của tin nhắn CŨ NHẤT trong list (tin cuối cùng của list DESC)
        Instant nextCursor = finalResponseList.isEmpty() ? null : finalResponseList.getLast().getCreatedAt();
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

        enrichPolls(ascResponseList, userId);
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
                .referenceUsers(new HashMap<>())
                .build();
    }

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

        // Map sang DTO
        List<MessageResponse> responseList = mongoMessages.stream()
                .map(messageMapper::toMessageResponse)
                .collect(Collectors.toList());

        // Xác định nextCursor cho lần cuộn xuống tiếp theo (Là phần tử cuối mảng)
        Instant nextCursor = responseList.isEmpty() ? null : responseList.getLast().getCreatedAt();

        enrichPolls(responseList, userId);
        responseList.forEach(msg -> msg.setDeletedFor(null));


        return CursorResponse.<List<MessageResponse>>builder()
                .data(responseList)
                .nextCursor(nextCursor)
                .hasMoreOlder(true)        // Đang lơ lửng ở quá khứ tiến lên, nên chắc chắn phía trên còn tin cũ
                .hasMoreNewer(hasMoreNewer) // Còn tin mới hơn không?
                .referenceUsers(new HashMap<>())
                .build();
    }
    /**
     * Hàm xử lý việc nhảy tin nhắn (khi người dùng click vào tin nhắn phản hồi và tin nhắn ghim)
     */
    public CursorResponse<List<MessageResponse>> jumpToMessage(Long conversationId, String targetMessageId, Long userId) {
        log.info("Jump to message");
        ConversationMemberResponse member = conversationMemberService.getMemberInfo(conversationId, userId);
        Message targetMsg = messageRepository.findById(targetMessageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));
        Instant clearedAt = member.getClearedAt();
        if (clearedAt != null &&
                targetMsg.getCreatedAt().toEpochMilli() <= clearedAt.toEpochMilli()) {
            throw new RuntimeException("Không thể tìm thấy tin nhắn");
        }
        if (targetMsg.getDeletedFor() != null &&
                targetMsg.getDeletedFor().contains(userId)) {
            throw new RuntimeException("Không thể tìm thấy tin nhắn");
        }
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


        resultList = resultList.stream()
                .filter(msg -> clearedAt == null || msg.getCreatedAt().toEpochMilli() > clearedAt.toEpochMilli())
                .filter(msg -> msg.getDeletedFor() == null || !msg.getDeletedFor().contains(userId))
                .collect(Collectors.toCollection(ArrayList::new));

        // Xóa cờ deletedFor trước khi trả về
        enrichPolls(resultList, userId);
        resultList.forEach(msg -> msg.setDeletedFor(null));

        return CursorResponse.<List<MessageResponse>>builder()
                .data(resultList)
                .hasMoreOlder(hasMoreOlder)
                .hasMoreNewer(hasMoreNewer)
                .referenceUsers(new HashMap<>()) // Đắp từ điển vào Response
                .build();
    }

    public MessageSearchResponse searchMessages(
            Long conversationId,
            Long userId,
            String keyword,
            Long senderId,
            Instant fromDate,
            Instant toDate,
            Instant cursor,
            int limit
    ) {
        ConversationMemberResponse currentMember = conversationMemberService.getMemberInfo(conversationId, userId);
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        int normalizedLimit = Math.max(1, Math.min(limit, 20));

        if (normalizedKeyword.isBlank()) {
            return MessageSearchResponse.builder()
                    .items(Collections.emptyList())
                    .nextCursor(null)
                    .hasMore(false)
                    .build();
        }

        List<Criteria> criteriaList = new ArrayList<>();
        criteriaList.add(Criteria.where("conversation_id").is(conversationId));
        criteriaList.add(Criteria.where("content").regex(
                Pattern.compile(Pattern.quote(normalizedKeyword), Pattern.CASE_INSENSITIVE)
        ));
        criteriaList.add(Criteria.where("isRecalled").ne(true));
        criteriaList.add(Criteria.where("deletedFor").ne(userId));

        if (senderId != null) {
            criteriaList.add(Criteria.where("sender_id").is(senderId));
        }

        if (fromDate != null) {
            criteriaList.add(Criteria.where("created_at").gte(fromDate));
        }

        if (toDate != null) {
            criteriaList.add(Criteria.where("created_at").lt(toDate));
        }

        if (cursor != null) {
            criteriaList.add(Criteria.where("created_at").lt(cursor));
        }

        if (currentMember.getClearedAt() != null) {
            criteriaList.add(Criteria.where("created_at").gt(currentMember.getClearedAt()));
        }

        Criteria criteria = new Criteria().andOperator(criteriaList.toArray(new Criteria[0]));
        Query query = new Query(criteria)
                .with(Sort.by(Sort.Direction.DESC, "created_at"))
                .limit(normalizedLimit + 1);

        List<Message> messages = mongoTemplate.find(query, Message.class);
        boolean hasMore = messages.size() > normalizedLimit;
        if (hasMore) {
            messages = messages.subList(0, normalizedLimit);
        }

        Map<Long, ConversationMemberResponse> membersMap = conversationMemberService.getMembersMap(conversationId);
        List<MessageSearchResult> items = messages.stream()
                .map(message -> toSearchResult(message, membersMap))
                .toList();

        String nextCursor = items.isEmpty() ? null : items.getLast().getCreatedAt().toString();

        return MessageSearchResponse.builder()
                .items(items)
                .nextCursor(hasMore ? nextCursor : null)
                .hasMore(hasMore)
                .build();
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

    private MessageSearchResult toSearchResult(
            Message message,
            Map<Long, ConversationMemberResponse> membersMap
    ) {
        Long senderId = message.getSenderId();
        ConversationMemberResponse member = senderId == null ? null : membersMap.get(senderId);
        String senderName = member == null ? null : member.getNickname();
        if ((senderName == null || senderName.isBlank()) && senderId != null) {
            try {
                User user = userService.findUserById(senderId);
                senderName = user.getName() != null && !user.getName().isBlank()
                        ? user.getName()
                        : user.getUsername();
            } catch (RuntimeException ignored) {
                senderName = null;
            }
        }

        return MessageSearchResult.builder()
                .messageId(message.getId())
                .conversationId(message.getConversationId())
                .senderId(senderId)
                .senderName(senderName)
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }

    private void enrichPolls(List<MessageResponse> messages, Long userId) {
        if (messages == null || messages.isEmpty()) {
            return;
        }
        messages.forEach(message -> enrichPoll(message, userId));
    }

    private void enrichPoll(MessageResponse message, Long userId) {
        if (message == null || message.getPollId() == null) {
            return;
        }
        if (message.getType() == MessageType.POLL) {
            message.setPoll(pollService.getPoll(message.getPollId(), userId));
            return;
        }
        if (isAnonymousPollActorMessage(message.getType())
                && pollService.getPoll(message.getPollId(), userId).isAnonymous()) {
            message.setSenderId(0L);
        }
    }

    private boolean isAnonymousPollActorMessage(MessageType type) {
        return type == MessageType.SYSTEM_POLL_VOTED
                || type == MessageType.SYSTEM_POLL_CHANGED;
    }

    public ConversationMediaResponse getConversationMedia(
            Long conversationId,
            Long userId,
            String type,
            Instant cursor,
            int limit) {
        ConversationMemberResponse member = conversationMemberService.getMemberInfo(conversationId, userId);
        int safeLimit = Math.max(1, Math.min(limit, 50));
        String normalizedType = type == null ? "MEDIA" : type.trim().toUpperCase();

        List<Criteria> criteria = new ArrayList<>();
        criteria.add(Criteria.where("conversation_id").is(conversationId));
        criteria.add(Criteria.where("isRecalled").ne(true));
        criteria.add(new Criteria().orOperator(
                Criteria.where("deletedFor").exists(false),
                Criteria.where("deletedFor").ne(userId)
        ));
        if (member.getClearedAt() != null) {
            criteria.add(Criteria.where("created_at").gt(member.getClearedAt()));
        }
        if (cursor != null) {
            criteria.add(Criteria.where("created_at").lt(cursor));
        }

        if ("FILE".equals(normalizedType)) {
            criteria.add(Criteria.where("message_type").is(MessageType.FILE));
        } else if ("LINK".equals(normalizedType)) {
            criteria.add(Criteria.where("content").regex(URL_PATTERN));
        } else {
            criteria.add(Criteria.where("message_type").in(MessageType.IMAGE, MessageType.VIDEO));
        }

        Query query = new Query(new Criteria().andOperator(criteria.toArray(new Criteria[0])))
                .with(Sort.by(Sort.Direction.DESC, "created_at"))
                .limit(safeLimit + 1);

        List<Message> messages = mongoTemplate.find(query, Message.class);
        boolean hasMore = messages.size() > safeLimit;
        if (hasMore) {
            messages = messages.subList(0, safeLimit);
        }

        List<ConversationMediaItem> items = messages.stream()
                .flatMap(message -> mapMediaItems(message, normalizedType).stream())
                .toList();
        Instant nextCursor = messages.isEmpty() ? null : messages.get(messages.size() - 1).getCreatedAt();

        return ConversationMediaResponse.builder()
                .items(items)
                .nextCursor(hasMore ? nextCursor : null)
                .hasMore(hasMore)
                .build();
    }

    private List<ConversationMediaItem> mapMediaItems(Message message, String type) {
        if ("LINK".equals(type)) {
            String content = message.getContent() == null ? "" : message.getContent();
            java.util.regex.Matcher matcher = URL_PATTERN.matcher(content);
            if (!matcher.find()) return Collections.emptyList();
            String url = matcher.group();
            if (url.toLowerCase().startsWith("www.")) {
                url = "https://" + url;
            }
            return List.of(ConversationMediaItem.builder()
                    .messageId(message.getId())
                    .conversationId(message.getConversationId())
                    .senderId(message.getSenderId())
                    .type("LINK")
                    .url(url)
                    .content(content)
                    .createdAt(message.getCreatedAt())
                    .build());
        }

        List<Message.MediaAttachment> attachments = message.getAttachments();
        if (attachments == null || attachments.isEmpty()) {
            String content = message.getContent();
            if (content == null || content.isBlank()) return Collections.emptyList();
            return List.of(ConversationMediaItem.builder()
                    .messageId(message.getId())
                    .conversationId(message.getConversationId())
                    .senderId(message.getSenderId())
                    .type(message.getMessageType().name())
                    .url(mediaUrlBuilder.build(content, message.getMessageType()))
                    .content(mediaUrlBuilder.build(content, message.getMessageType()))
                    .createdAt(message.getCreatedAt())
                    .build());
        }

        return attachments.stream()
                .map(attachment -> ConversationMediaItem.builder()
                        .messageId(message.getId())
                        .conversationId(message.getConversationId())
                        .senderId(message.getSenderId())
                        .type(message.getMessageType().name())
                        .url(mediaUrlBuilder.buildAttachment(attachment.getUrl()))
                        .content(message.getContent())
                        .fileName(attachment.getFileName())
                        .fileSize(attachment.getFileSize())
                        .createdAt(message.getCreatedAt())
                        .build())
                .toList();
    }
}
