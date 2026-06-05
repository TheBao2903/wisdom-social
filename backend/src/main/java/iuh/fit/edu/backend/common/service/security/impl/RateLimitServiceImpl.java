package iuh.fit.edu.backend.common.service.security.impl;

import iuh.fit.edu.backend.common.service.security.RateLimitService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class RateLimitServiceImpl implements RateLimitService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_SECONDS = 900; // 15 minutes

    private final StringRedisTemplate redisTemplate;

    public RateLimitServiceImpl(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public long checkLoginLock(String phone, String ip) {
        String lockKey = "rate:login:lock:" + phone + ":" + ip;
        Long ttl = redisTemplate.getExpire(lockKey, TimeUnit.SECONDS);
        if (ttl != null && ttl > 0) {
            return ttl;
        }
        return 0;
    }

    @Override
    public long recordFailedLogin(String phone, String ip) {
        String countKey = "rate:login:" + phone + ":" + ip;
        String lockKey = "rate:login:lock:" + phone + ":" + ip;

        Long count = redisTemplate.opsForValue().increment(countKey);
        if (count != null && count == 1) {
            redisTemplate.expire(countKey, LOCK_SECONDS, TimeUnit.SECONDS);
        }

        if (count != null && count >= MAX_ATTEMPTS) {
            redisTemplate.opsForValue().set(lockKey, "1", LOCK_SECONDS, TimeUnit.SECONDS);
            redisTemplate.delete(countKey);
            return LOCK_SECONDS;
        }
        return 0;
    }

    @Override
    public void clearLoginAttempts(String phone, String ip) {
        String countKey = "rate:login:" + phone + ":" + ip;
        String lockKey = "rate:login:lock:" + phone + ":" + ip;
        redisTemplate.delete(countKey);
        redisTemplate.delete(lockKey);
    }

    @Override
    public long checkOtpLock(String phone) {
        String lockKey = "rate:otp:lock:" + phone;
        Long ttl = redisTemplate.getExpire(lockKey, TimeUnit.SECONDS);
        if (ttl != null && ttl > 0) {
            return ttl;
        }
        return 0;
    }

    @Override
    public long recordFailedOtp(String phone) {
        String countKey = "rate:otp:" + phone;
        String lockKey = "rate:otp:lock:" + phone;

        Long count = redisTemplate.opsForValue().increment(countKey);
        if (count != null && count == 1) {
            redisTemplate.expire(countKey, LOCK_SECONDS, TimeUnit.SECONDS);
        }

        if (count != null && count >= MAX_ATTEMPTS) {
            redisTemplate.opsForValue().set(lockKey, "1", LOCK_SECONDS, TimeUnit.SECONDS);
            redisTemplate.delete(countKey);
            return LOCK_SECONDS;
        }
        return 0;
    }

    @Override
    public void clearOtpAttempts(String phone) {
        String countKey = "rate:otp:" + phone;
        String lockKey = "rate:otp:lock:" + phone;
        redisTemplate.delete(countKey);
        redisTemplate.delete(lockKey);
    }
}
