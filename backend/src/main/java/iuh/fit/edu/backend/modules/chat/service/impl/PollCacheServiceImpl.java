package iuh.fit.edu.backend.modules.chat.service.impl;

import iuh.fit.edu.backend.modules.chat.dto.response.poll.PollResponse;
import iuh.fit.edu.backend.modules.chat.service.PollCacheService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class PollCacheServiceImpl implements PollCacheService {
    private static final Duration TTL = Duration.ofHours(6);
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public PollResponse getPoll(String pollId) {
        Object value = redisTemplate.opsForValue().get(getKey(pollId));
        if (value instanceof PollResponse pollResponse) {
            return pollResponse;
        }
        return null;
    }

    @Override
    public void cachePoll(PollResponse pollResponse) {
        if (pollResponse == null || pollResponse.getId() == null) {
            return;
        }
        redisTemplate.opsForValue().set(getKey(pollResponse.getId()), pollResponse, TTL);
    }

    @Override
    public void evictPoll(String pollId) {
        if (pollId != null) {
            redisTemplate.delete(getKey(pollId));
        }
    }

    private String getKey(String pollId) {
        return "chat:poll:" + pollId;
    }
}
