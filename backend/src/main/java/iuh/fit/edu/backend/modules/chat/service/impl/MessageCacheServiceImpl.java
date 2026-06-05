/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service.impl;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import iuh.fit.edu.backend.modules.chat.dto.response.MessageRecalledResponse;
import iuh.fit.edu.backend.modules.chat.dto.response.MessageResponse;
import iuh.fit.edu.backend.modules.chat.service.MessageCacheService;
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
public class MessageCacheServiceImpl implements MessageCacheService {
    private final RedisTemplate<String, Object> redisTemplate;

    // Lưu 60 tin nhắn mới nhất (sẽ scroll được 3 lần)
    private static final int CACHE_SIZE = 60;

    // Tin nhắn sẽ tự hủy sau 1 ngày
    private static final Duration TTL = Duration.ofDays(1);

    private String getKey(Long conversationId) {
        return "chat:messages:" + conversationId;
    }

    /**
     * Kéo toàn bộ danh sách Object từ Redis về RAM
     */
    private List<Object> getFullListFromCache(String key) {
        return redisTemplate.opsForList().range(key, 0, -1);
    }

    /**
     * Tìm vị trí (index) của 1 tin nhắn cụ thể trong mảng Cache
     * @return index (từ 0 trở đi), hoặc -1 nếu không tìm thấy
     */
    private int findMessageIndex(List<Object> cachedObjects, String messageId) {
        if (cachedObjects == null || cachedObjects.isEmpty()) return -1;
        for (int i = 0; i < cachedObjects.size(); i++) {
            MessageResponse cachedMsg = (MessageResponse) cachedObjects.get(i);
            if (cachedMsg.getId().equals(messageId)) {
                return i;
            }
        }
        return -1;
    }

    private MessageResponse withoutPollDetail(MessageResponse source) {
        if (source == null || source.getPoll() == null) {
            return source;
        }
        MessageResponse copy = new MessageResponse();
        copy.setId(source.getId());
        copy.setConversationId(source.getConversationId());
        copy.setContent(source.getContent());
        copy.setType(source.getType());
        copy.setCreatedAt(source.getCreatedAt());
        copy.setSenderId(source.getSenderId());
        copy.setPollId(source.getPollId());
        copy.setReplyInfo(source.getReplyInfo());
        copy.setActive(source.isActive());
        copy.setRecalled(source.isRecalled());
        copy.setAttachments(source.getAttachments());
        copy.setIconName(source.getIconName());
        copy.setDeletedFor(source.getDeletedFor());
        return copy;
    }

    /**
     * Dùng để lưu tin nhắn mới nhất vào cache (dùng khi sendMessage)
     */
    @Override
    public void cacheNewMessage(MessageResponse message) {
        String key = getKey(message.getConversationId());
        log.info("Push message to cache {}", message);

        // Push tin nhắn mới nhất vào đầu danh sách
        redisTemplate.opsForList().leftPush(key, withoutPollDetail(message));

        // Cắt bớt nếu dài quá 50 tin nhắn (chỉ giữ index từ 0 đến 49)
        redisTemplate.opsForList().trim(key, 0, CACHE_SIZE - 1);

        // Gian hạn thời gian sống của cache
        redisTemplate.expire(key, TTL);
    }

    public void updateMessage(MessageRecalledResponse message) {
        String key = getKey(message.getConversationId());
        // Kiểm tra xem cache của phòng chat này có đang tồn tại không
        if (Boolean.FALSE.equals(redisTemplate.hasKey(key))) {
            return; // Cache trống hoặc đã hết hạn -> Bỏ qua
        }
        // Lấy phần tử cuối cùng trong Redis (Tin nhắn cũ nhất của Cache)
        MessageResponse lastObj = (MessageResponse) redisTemplate.opsForList().index(key, -1);
        if (lastObj != null) {
            // Nếu tin nhắn bị thu hồi có thời gian CŨ HƠN tin cũ nhất trong Cache
            // => Chắc chắn nó không nằm trong Cache. Dừng luôn, không cần lấy List về!
            if (message.getCreatedAt().isBefore(lastObj.getCreatedAt())) {
                log.info("Tin nhắn thu hồi quá cũ, không nằm trong Cache. Bỏ qua tìm kiếm.");
                return;
            }
            // Lấy toàn bộ List từ Redis về RAM
            List<Object> objects = getFullListFromCache(key);
            if (objects == null || objects.isEmpty()) return;

            // Tìm vị trí (index) của tin nhắn cần thu hồi
            for (int i = 0; i < objects.size(); i++) {
                MessageResponse cachedMsg = (MessageResponse) objects.get(i);
                boolean isModified = false;

                // So sánh ID để tìm đúng tin nhắn
                if (cachedMsg.getId().equals(message.getMessageId())) {
                    // Cập nhật dữ liệu tin nhắn: Xóa nội dung, bật cờ isRecalled
                    cachedMsg.setContent("");
                    cachedMsg.setRecalled(true);
                    if (cachedMsg.getAttachments() != null) {
                        cachedMsg.setAttachments(new ArrayList<>());
                    }
                    isModified = true;
                }

                // Xử lý các tin nhắn khác đang Reply lại tin nhắn vừa được thu hồi
                if(cachedMsg.getReplyInfo() != null && cachedMsg.getReplyInfo().getMessageId().equals(message.getMessageId())){
                    cachedMsg.getReplyInfo().setContent("");
                    isModified = true;
                }

                // Lưu lại vị trí đã sửa
                if(isModified){
                    redisTemplate.opsForList().set(key, i, cachedMsg);
                    log.info("Đã cập nhật tin nhắn thu hồi trong Redis tại index: {}", i);
                }
            }
        }
    }

    @Override
    public void updateMessage(MessageResponse message) {
        String key = getKey(message.getConversationId());
        if (Boolean.FALSE.equals(redisTemplate.hasKey(key))) {
            return;
        }

        List<Object> objects = getFullListFromCache(key);
        int targetIndex = findMessageIndex(objects, message.getId());
        if (targetIndex == -1) {
            return;
        }

        redisTemplate.opsForList().set(key, targetIndex, message);
        log.info("Đã cập nhật tin nhắn {} trong Redis tại index: {}", message.getId(), targetIndex);
    }

    @Override
    public void addDeletedUserToMessage(String messageId, Long conversationId, Long userId) {
        String key = getKey(conversationId);

        // Kiểm tra xem cache của phòng chat này có đang tồn tại không
        if (Boolean.FALSE.equals(redisTemplate.hasKey(key))) {
            return;
        }

        // Lấy danh sách 60 tin nhắn từ RAM về
        List<Object> objects = getFullListFromCache(key);
        int targetIndex = findMessageIndex(objects, messageId);

        // Tìm vị trí của tin nhắn cần đánh dấu xóa
        if (targetIndex != -1) {
            MessageResponse cachedMsg = (MessageResponse) objects.get(targetIndex);

            if (cachedMsg.getDeletedFor() == null) {
                cachedMsg.setDeletedFor(new HashSet<>());
            }
            cachedMsg.getDeletedFor().add(userId);

            redisTemplate.opsForList().set(key, targetIndex, cachedMsg);
            log.info("Đã cập nhật deletedFor cho tin nhắn {} trong Redis tại index: {}", messageId, targetIndex);
        }
    }

    @Override
    public void clearCache(Long conversationId) {
        String key = getKey(conversationId);
        redisTemplate.delete(key);
        log.info("Đã xóa hoàn toàn List cache của phòng chat {}", conversationId);
    }

    /**
     * Lấy danh sách tin nhắn từ cache (dùng khi load trang đầu hoặc scroll nếu vẫn còn dữ liệu trong redis)
     * Giúp tăng tốc độ thay vì cứ phải truy vấn xuống db
     */
    @Override
    public List<MessageResponse> getListMessage(Long conversationId, Instant cursor, int limit) {
        String key = getKey(conversationId);
        List<Object> objects;
        // Case 1: Lấy trang đầu từ 0 đến limit - 1
        if (cursor == null) {
            objects = redisTemplate.opsForList().range(key, 0, limit - 1);

            if (objects == null || objects.isEmpty()) {
                return Collections.emptyList();
            }

            return objects.stream()
                    .map(object -> (MessageResponse) object)
                    .toList();
        } else {
            // Case 2: Load lịch sử tin nhắn trong trường hợp vẫn chứa lấy hết 60 tin từ cache
            objects = getFullListFromCache(key);
            List<MessageResponse> allCached = objects == null
                    ? Collections.emptyList()
                    : objects.stream()
                    .map(object -> (MessageResponse) object)
                    .toList();

            // Tìm vị trí của Cursor trong danh sách
            int cursorIndex = -1;
            for (int i = 0; i < allCached.size(); i++) {
                // So sánh createdAt để tìm điểm cắt
                if (allCached.get(i).getCreatedAt().equals(cursor)) {
                    cursorIndex = i;
                    break;
                }
            }
            if (cursorIndex == -1) {
                // Cursor không nằm trong Redis (Tin nhắn quá cũ) -> Cache Miss
                return Collections.emptyList();
            }
            // Tìm thấy Cursor, cần lấy các tin sau vị trí đó (Cũ hơn)
            int startIndex = cursorIndex + 1;
            int endIndex = startIndex + limit;

            // Chỉ trả về nếu Redis CÓ ĐỦ số lượng tin yêu cầu
            if (endIndex <= allCached.size()) {
                // HIT CACHE: Redis có đủ 20 tin tiếp theo
                return allCached.subList(startIndex, endIndex);
            }

            // Redis có cursor, nhưng không còn đủ số lượng tin yêu cầu (VD: Còn 5 tin, mà cần 20)
            // Return rỗng để fallback về MongoDB lấy cho đủ bộ
            return Collections.emptyList();
        }

    }

    /**
     * Lưu danh sách tin nhắn vào cache
     * Dùng khi cache miss - lần đầu tiên load từ db
     * Tiếp tục lưu tin nhắn vào cache khi scroll cho dến khi đặt đến gới hạn (size = 50)
     * Giúp tăng tốc độ thay vì cứ phải truy vấn xuống db
     */
    @Override
    public void cacheListMessage(Long conversationId, List<MessageResponse> messageResponses, Instant cursor) {
        if (messageResponses.isEmpty()) return;
        String key = getKey(conversationId);
        // Case 1: Load trang lần đầu
        if (cursor == null) {
            // Xóa cũ để đảm bảo không bị dư thừa hay trùng lặp dữ liệu không mong muốn
            redisTemplate.delete(key);
            redisTemplate.opsForList().rightPushAll(key, messageResponses.toArray());

            // Dù có bao nhiêu luồng push vào cùng lúc, chỉ giữ lại đúng số lượng message response
            redisTemplate.opsForList().trim(key, 0, messageResponses.size() - 1);
            redisTemplate.expire(key, TTL);
            log.info("Push messages (First Load), size redis: {} ", redisTemplate.opsForList().size(key));
        }
        // Case 2: Lưu thêm dữ liệu khi scroll
        else {
            // Chỉ append nếu key còn tồn tại để tránh sai lệch data
            if (Boolean.TRUE.equals(redisTemplate.hasKey(key))) {
                MessageResponse lastObj = (MessageResponse) redisTemplate.opsForList().index(key, -1);
                if (lastObj != null) {
                    if (!cursor.equals(lastObj.getCreatedAt())) {
                        log.warn("Cursor không khớp dòng thời gian liên tục (có thể do Jump). Bỏ qua Append để tránh tạo hố đen dữ liệu. ConvId: {}", conversationId);
                        return;
                    }
                    MessageResponse lastCachedMsg = lastObj;
                    MessageResponse firstNewMsg = messageResponses.getFirst();

                    //  FirstNewMsg phải CŨ HƠN (nhỏ hơn) lastCachedMsg
                    // Nếu firstNewMsg >= lastCachedMsg -> Nghĩa là dữ liệu bị trùng hoặc lộn xộn -> KHÔNG PUSH
                    if (!firstNewMsg.getCreatedAt().isBefore(lastCachedMsg.getCreatedAt())) {
                        log.warn("Phát hiện dữ liệu trùng lặp hoặc không khớp cursor. Bỏ qua Append. ConvId: {}", conversationId);
                        return;
                    }

                    // Check ID cho chắc chắn (trường hợp cùng millisecond)
                    if (firstNewMsg.getId().equals(lastCachedMsg.getId())) {
                        log.warn("Phát hiện trùng ID tin nhắn cuối. Bỏ qua Append.");
                        return;
                    }
                }
                Long currentSize = redisTemplate.opsForList().size(key);
                // Nếu trong redis đã đủ 60 dữ liệu rồi thì không push thêm vào nữa
                if (currentSize != null && currentSize < CACHE_SIZE) {
                    redisTemplate.opsForList().rightPushAll(key, messageResponses.toArray());

                    // Sau khi push, nếu tổng vượt quá 60 thì mới trim
                    if (currentSize + messageResponses.size() > CACHE_SIZE) {
                        redisTemplate.opsForList().trim(key, 0, CACHE_SIZE - 1);
                    }
                    redisTemplate.expire(key, TTL);
                    log.info("Append messages, size redis: {} ", Optional.ofNullable(redisTemplate.opsForList().size(key)).orElse(0L));
                }
            }
        }
    }

    @Override
    public List<MessageResponse> getJumpMessagesFromCache(Long conversationId, String targetMessageId) {
        String key = getKey(conversationId);

        // Kéo toàn bộ 60 tin nhắn từ Redis về RAM (Tối đa 60 nên rất nhanh)
        List<Object> objects = getFullListFromCache(key);
        int targetIndex = findMessageIndex(objects, targetMessageId);

        // Nếu tìm thấy (Redis Hit)
        if (targetIndex != -1) {
            List<MessageResponse> cachedMessages = objects.stream().map(obj -> (MessageResponse) obj).toList();
            // Lấy từ tin mới nhất (index 0) đến tin mục tiêu + 10 tin cũ hơn làm ngữ cảnh
            int endIndex = Math.min(targetIndex + 11, cachedMessages.size());

            // Cắt mảng và tạo bản sao mới để tránh lỗi SubList của Jackson khi trả về
            return new ArrayList<>(cachedMessages.subList(0, endIndex));
        }

        // Không tìm thấy trong 60 tin đầu (Redis Miss)
        return Collections.emptyList();
    }
}
