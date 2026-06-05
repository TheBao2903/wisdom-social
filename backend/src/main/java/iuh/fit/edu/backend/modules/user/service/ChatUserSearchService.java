package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.dto.response.ChatUserSearchResponse;

import java.util.Optional;

public interface ChatUserSearchService {
    Optional<ChatUserSearchResponse> searchByPhone(String phone, Long currentUserId);

    Optional<ChatUserSearchResponse> getRelationship(Long userId, Long currentUserId);
}
