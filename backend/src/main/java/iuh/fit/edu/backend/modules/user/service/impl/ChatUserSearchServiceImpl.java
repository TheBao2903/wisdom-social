package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.common.util.MediaUrlBuilder;
import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.service.DirectConversationService;
import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import iuh.fit.edu.backend.modules.user.dto.response.ChatUserSearchResponse;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.service.ChatUserSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatUserSearchServiceImpl implements ChatUserSearchService {
    private final UserRepository userRepository;
    private final FriendRepository friendRepository;
    private final BlockUserRepository blockUserRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final DirectConversationService directConversationService;
    private final MediaUrlBuilder mediaUrlBuilder;

    @Override
    public Optional<ChatUserSearchResponse> searchByPhone(String phone, Long currentUserId) {
        String normalizedPhone = normalizePhone(phone);
        if (normalizedPhone == null || normalizedPhone.length() != 10 || currentUserId == null) {
            return Optional.empty();
        }

        User user = userRepository.findByPhone(normalizedPhone);
        if (user == null || user.getId() == null || user.getId().equals(currentUserId)) {
            return Optional.empty();
        }
        if (user.isLocked() || user.getDeletionScheduledFor() != null) {
            return Optional.empty();
        }

        return buildResponse(user, currentUserId);
    }

    @Override
    public Optional<ChatUserSearchResponse> getRelationship(Long userId, Long currentUserId) {
        if (userId == null || currentUserId == null || userId.equals(currentUserId)) {
            return Optional.empty();
        }

        return userRepository.findById(userId)
                .filter(user -> !user.isLocked() && user.getDeletionScheduledFor() == null)
                .flatMap(user -> buildResponse(user, currentUserId));
    }

    private Optional<ChatUserSearchResponse> buildResponse(User user, Long currentUserId) {
        boolean isFriend = friendRepository.countAcceptedFriendship(
                currentUserId,
                user.getId()
        ) > 0;
        boolean blocked = blockUserRepository.existsByBlocker_IdAndBlocked_Id(currentUserId, user.getId())
                || blockUserRepository.existsByBlocker_IdAndBlocked_Id(user.getId(), currentUserId);
        Long existingConversationId = conversationRepository
                .findByDirectKey(directConversationService.buildDirectKey(currentUserId, user.getId()))
                .map(conversation -> conversation.getId())
                .or(() -> conversationRepository.findDirectConversationsByMemberIds(currentUserId, user.getId())
                        .stream()
                        .findFirst()
                        .map(conversation -> conversation.getId()))
                .orElse(null);
        long mutualGroups = conversationMemberRepository.countCommonActiveGroups(currentUserId, user.getId());

        log.info("Chat user search phone={} currentUserId={} targetUserId={} existingDirectConversationId={}",
                user.getPhone(), currentUserId, user.getId(), existingConversationId);

        return Optional.of(ChatUserSearchResponse.builder()
                .userId(user.getId())
                .name(user.getName())
                .username(user.getUsername())
                .phone(user.getPhone())
                .avatarUrl(mediaUrlBuilder.build(user.getAvatarUrl(), MessageType.IMAGE))
                .friendStatus(isFriend ? "FRIEND" : "STRANGER")
                .mutualGroupsCount(mutualGroups)
                .existingDirectConversationId(existingConversationId)
                .blocked(blocked)
                .build());
    }

    private String normalizePhone(String rawPhone) {
        if (rawPhone == null) return null;
        String digits = rawPhone.replaceAll("\\D", "");
        if (digits.startsWith("84") && digits.length() == 11) {
            return "0" + digits.substring(2);
        }
        if (digits.length() == 9) {
            return "0" + digits;
        }
        return digits;
    }
}
