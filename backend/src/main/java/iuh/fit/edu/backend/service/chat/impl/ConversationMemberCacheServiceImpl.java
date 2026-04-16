package iuh.fit.edu.backend.service.chat.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.dto.response.conversation.ConversationMemberResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationMemberCacheServiceImpl implements iuh.fit.edu.backend.service.chat.ConversationMemberCacheService {

    // RedisTemplate đã cấu hình GenericJackson2JsonRedisSerializer để tự động ép kiểu
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Hàm sinh Key cho Redis. Cấu trúc: conversation:members:{conversationId}
     */
    private String getRedisKey(Long conversationId) {
        return "conversation:members:" + conversationId;
    }

    /**
     * Lấy toàn bộ danh sách thành viên của một phòng từ Redis.
     * Sử dụng lệnh HGETALL (entries) cực kỳ nhanh.
     */
    @Override
    public Map<Long, ConversationMemberResponse> getMembersMap(Long conversationId) {
        String redisKey = getRedisKey(conversationId);
        Map<Object, Object> cachedData = redisTemplate.opsForHash().entries(redisKey);

        if (cachedData.isEmpty()) {
            return new HashMap<>(); // Trả về Map rỗng nếu Cache Miss
        }

        Map<Long, ConversationMemberResponse> resultMap = new HashMap<>();
        // Ép kiểu dữ liệu từ Object của Redis về đúng class DTO
        for (Map.Entry<Object, Object> entry : cachedData.entrySet()) {
            Long key = Long.parseLong(entry.getKey().toString());
            ConversationMemberResponse value = objectMapper.convertValue(entry.getValue(), ConversationMemberResponse.class);
            resultMap.put(key, value);
        }
        return resultMap;
    }

    /**
     * Lấy thông tin của ĐÚNG MỘT NGƯỜI từ Redis Hash.
     * Tốc độ O(1), không cần lôi cả ngàn người lên.
     */
    @Override
    public ConversationMemberResponse getMemberInfo(Long conversationId, Long userId) {
        String redisKey = getRedisKey(conversationId);
        Object cachedMember = redisTemplate.opsForHash().get(redisKey, userId.toString());

        if (cachedMember != null) {
            return objectMapper.convertValue(cachedMember, ConversationMemberResponse.class);
        }
        return null; // Cache Miss
    }

    /**
     * Lưu toàn bộ danh sách thành viên (lấy từ MySQL) vào Redis Hash.
     * Sử dụng lệnh HMSET (putAll) để lưu đồng loạt 1 lần.
     */
    @Override
    public void saveMembersMap(Long conversationId, Map<Long, ConversationMemberResponse> dbMap) {
        if (dbMap == null || dbMap.isEmpty()) return;
        String redisKey = getRedisKey(conversationId);

        // Chuyển Key từ Long sang String để Redis dễ quản lý
        Map<String, Object> stringKeyMap = new HashMap<>();
        dbMap.forEach((k, v) -> stringKeyMap.put(k.toString(), v));

        redisTemplate.opsForHash().putAll(redisKey, stringKeyMap);
        redisTemplate.expire(redisKey, Duration.ofDays(7)); // Sống 7 ngày
    }

    /**
     * Lưu hoặc cập nhật thông tin của MỘT NGƯỜI vào Redis Hash.
     * Dùng khi cập nhật trạng thái (Seen, ClearedAt) hoặc đổi biệt danh.
     */
    @Override
    public void saveMemberInfo(Long conversationId, Long userId, ConversationMemberResponse info) {
        if (info == null) return;
        String redisKey = getRedisKey(conversationId);
        // HSET: Ghi đè vào đúng ô của user đó
        redisTemplate.opsForHash().put(redisKey, userId.toString(), info);
    }
}