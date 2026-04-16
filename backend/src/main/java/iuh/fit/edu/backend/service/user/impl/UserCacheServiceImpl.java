package iuh.fit.edu.backend.service.user.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserCacheServiceImpl implements iuh.fit.edu.backend.service.user.UserCacheService {

    private final StringRedisTemplate redisTemplate;
    private static final String ONLINE_SESSIONS_KEY = "user:online:sessions:";

    // Thêm Session khi user mở thiết bị. Trả về true nếu là thiết bị đầu tiên (Mới online)
    @Override
    public boolean addOnlineSession(Long userId, String sessionId) {
        String key = ONLINE_SESSIONS_KEY + userId;
        redisTemplate.opsForSet().add(key, sessionId);
        
        Long activeSessions = redisTemplate.opsForSet().size(key);
        return activeSessions != null && activeSessions == 1;
    }

    // Rút Session khi user tắt thiết bị. Trả về true nếu là thiết bị cuối cùng (Chính thức offline)
    @Override
    public boolean removeOnlineSession(Long userId, String sessionId) {
        String key = ONLINE_SESSIONS_KEY + userId;
        redisTemplate.opsForSet().remove(key, sessionId);
        
        Long activeSessions = redisTemplate.opsForSet().size(key);
        return activeSessions == null || activeSessions == 0;
    }

    // Kiểm tra nhanh xem user có đang online không (Dùng cho hàm Init API)
    @Override
    public boolean isUserOnline(Long userId) {
        String key = ONLINE_SESSIONS_KEY + userId;
        Long activeSessions = redisTemplate.opsForSet().size(key);
        return activeSessions != null && activeSessions > 0;
    }
}