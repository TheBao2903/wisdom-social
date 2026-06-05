package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.service.UserPresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserPresenceServiceImpl implements UserPresenceService {

    // Set tổng để scheduler biết user nào đang có session cần kiểm tra.
    private static final String ONLINE_USERS_KEY = "user:online:users";
    // Set theo từng user để xử lý nhiều tab/thiết bị: chỉ offline khi set này rỗng.
    private static final String USER_SESSIONS_KEY_PREFIX = "user:online:sessions:";
    // Key TTL theo từng session; heartbeat sẽ gia hạn key này, mất heartbeat thì key tự hết hạn.
    private static final String SESSION_USER_KEY_PREFIX = "user:online:session:";
    private static final Duration SESSION_TTL = Duration.ofSeconds(90);

    private final StringRedisTemplate redisTemplate;
    private final UserRepository userRepository;
    private final FriendRepository friendRepository;

    @Override
    public Optional<User> findUserByPrincipalName(String principalName) {
        if (!StringUtils.hasText(principalName)) {
            return Optional.empty();
        }
        return Optional.ofNullable(userRepository.findByPhone(normalizePhone(principalName)));
    }

    @Override
    public Optional<Long> findUserIdBySessionId(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return Optional.empty();
        }
        String rawUserId = redisTemplate.opsForValue().get(sessionUserKey(sessionId));
        if (!StringUtils.hasText(rawUserId)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.valueOf(rawUserId));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }

    @Override
    public boolean registerSession(Long userId, String sessionId) {
        if (userId == null || !StringUtils.hasText(sessionId)) {
            return false;
        }

        String userKey = userSessionsKey(userId);
        Long activeBefore = pruneExpiredSessions(userId);
        // Ghi cả set user->sessions và key session->user để disconnect có thể dọn chính xác.
        redisTemplate.opsForSet().add(userKey, sessionId);
        redisTemplate.opsForValue().set(sessionUserKey(sessionId), String.valueOf(userId), SESSION_TTL);
        redisTemplate.opsForSet().add(ONLINE_USERS_KEY, String.valueOf(userId));

        return activeBefore == null || activeBefore == 0;
    }

    @Override
    public boolean refreshSession(Long userId, String sessionId) {
        if (userId == null || !StringUtils.hasText(sessionId)) {
            return false;
        }

        String sessionKey = sessionUserKey(sessionId);
        Boolean exists = redisTemplate.hasKey(sessionKey);
        if (!Boolean.TRUE.equals(exists)) {
            return registerSession(userId, sessionId);
        }

        // Heartbeat chỉ gia hạn TTL, không publish event để tránh spam WebSocket.
        redisTemplate.expire(sessionKey, SESSION_TTL);
        return false;
    }

    @Override
    public boolean removeSession(Long userId, String sessionId) {
        if (userId == null || !StringUtils.hasText(sessionId)) {
            return false;
        }

        String userKey = userSessionsKey(userId);
        redisTemplate.opsForSet().remove(userKey, sessionId);
        redisTemplate.delete(sessionUserKey(sessionId));

        Long activeSessions = pruneExpiredSessions(userId);
        if (activeSessions == null || activeSessions == 0) {
            redisTemplate.delete(userKey);
            redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, String.valueOf(userId));
            return true;
        }
        return false;
    }

    @Override
    public List<UserStatusResponse> getStatuses(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> distinctIds = userIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        return userRepository.findAllById(distinctIds).stream()
                .map(user -> {
                    boolean online = isOnline(user.getId());
                    return UserStatusResponse.builder()
                            .userId(user.getId())
                            .isOnline(online)
                            .lastActiveAt(online ? null : user.getLastActiveAt())
                            .build();
                })
                .toList();
    }

    @Override
    public List<UserStatusResponse> getStatusesForViewer(Long viewerId, Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> distinctIds = userIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Set<Long> allowedIds = resolveAllowedPresenceTargetIds(viewerId, distinctIds);
        List<UserStatusResponse> visibleStatuses = getStatuses(allowedIds);
        var visibleStatusByUserId = visibleStatuses.stream()
                .collect(java.util.stream.Collectors.toMap(
                        UserStatusResponse::getUserId,
                        status -> status
                ));

        return distinctIds.stream()
                .map(userId -> {
                    UserStatusResponse visibleStatus = visibleStatusByUserId.get(userId);
                    if (visibleStatus != null) {
                        return visibleStatus;
                    }

                    // Người không phải bạn bè không được xem presence, kể cả đã có hội thoại trực tiếp.
                    return UserStatusResponse.builder()
                            .userId(userId)
                            .isOnline(false)
                            .lastActiveAt(null)
                            .build();
                })
                .toList();
    }

    @Override
    public Set<Long> getPresenceRecipientIds(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }

        Set<Long> recipientIds = new HashSet<>(
                friendRepository.findAcceptedFriendIds(userId, FriendStatus.ACCEPTED.ordinal())
        );
        recipientIds.add(userId);
        return recipientIds;
    }

    @Override
    public List<Long> cleanupExpiredSessions() {
        List<Long> offlineUserIds = new ArrayList<>();
        Set<String> userIds = redisTemplate.opsForSet().members(ONLINE_USERS_KEY);
        if (userIds == null || userIds.isEmpty()) {
            return offlineUserIds;
        }

        for (String rawUserId : userIds) {
            try {
                Long userId = Long.valueOf(rawUserId);
                // Scheduler là lớp dự phòng cho mất mạng/app crash: session TTL hết nhưng DISCONNECT không tới.
                Long activeSessions = pruneExpiredSessions(userId);
                if (activeSessions == null || activeSessions == 0) {
                    redisTemplate.delete(userSessionsKey(userId));
                    redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, rawUserId);
                    offlineUserIds.add(userId);
                }
            } catch (NumberFormatException ex) {
                log.warn("Bỏ qua userId presence không hợp lệ trong Redis: {}", rawUserId);
                redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, rawUserId);
            }
        }

        return offlineUserIds;
    }

    private boolean isOnline(Long userId) {
        Long activeSessions = pruneExpiredSessions(userId);
        return activeSessions != null && activeSessions > 0;
    }

    private Set<Long> resolveAllowedPresenceTargetIds(Long viewerId, List<Long> targetIds) {
        if (viewerId == null || targetIds.isEmpty()) {
            return Collections.emptySet();
        }

        Set<Long> acceptedFriendIds = new HashSet<>(
                friendRepository.findAcceptedFriendIds(viewerId, FriendStatus.ACCEPTED.ordinal())
        );
        Set<Long> allowedIds = new HashSet<>();
        for (Long targetId : targetIds) {
            if (Objects.equals(viewerId, targetId) || acceptedFriendIds.contains(targetId)) {
                allowedIds.add(targetId);
            }
        }
        return allowedIds;
    }

    private Long pruneExpiredSessions(Long userId) {
        String userKey = userSessionsKey(userId);
        Set<String> sessionIds = redisTemplate.opsForSet().members(userKey);
        if (sessionIds == null || sessionIds.isEmpty()) {
            return 0L;
        }

        for (String sessionId : sessionIds) {
            Boolean exists = redisTemplate.hasKey(sessionUserKey(sessionId));
            if (!Boolean.TRUE.equals(exists)) {
                redisTemplate.opsForSet().remove(userKey, sessionId);
            }
        }
        return redisTemplate.opsForSet().size(userKey);
    }

    private String userSessionsKey(Long userId) {
        return USER_SESSIONS_KEY_PREFIX + userId;
    }

    private String sessionUserKey(String sessionId) {
        return SESSION_USER_KEY_PREFIX + sessionId;
    }

    private String normalizePhone(String phone) {
        String normalized = phone.trim().replaceAll("\\s+", "");
        if (normalized.startsWith("+84")) {
            return "0" + normalized.substring(3);
        }
        if (normalized.startsWith("84")) {
            return "0" + normalized.substring(2);
        }
        return normalized;
    }
}
