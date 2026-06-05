package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.modules.user.entity.User;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface UserPresenceService {
    Optional<User> findUserByPrincipalName(String principalName);

    Optional<Long> findUserIdBySessionId(String sessionId);

    boolean registerSession(Long userId, String sessionId);

    boolean refreshSession(Long userId, String sessionId);

    boolean removeSession(Long userId, String sessionId);

    List<UserStatusResponse> getStatuses(Collection<Long> userIds);

    List<UserStatusResponse> getStatusesForViewer(Long viewerId, Collection<Long> userIds);

    Set<Long> getPresenceRecipientIds(Long userId);

    List<Long> cleanupExpiredSessions();
}
