package iuh.fit.edu.backend.modules.conversation.service.impl;

import iuh.fit.edu.backend.modules.conversation.dto.response.DirectConversationResolveResult;
import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.service.DirectConversationService;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.BlockUserRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DirectConversationServiceImpl implements DirectConversationService {
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final BlockUserRepository blockUserRepository;
    private final DirectConversationCreationService directConversationCreationService;

    @Override
    @Transactional
    public DirectConversationResolveResult getOrCreateDirectConversation(Long senderId, Long receiverId) {
        if (senderId == null || receiverId == null) {
            throw new IllegalArgumentException("Nguoi nhan khong hop le");
        }
        if (senderId.equals(receiverId)) {
            throw new IllegalArgumentException("Khong the tu nhan tin cho chinh minh");
        }

        userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay nguoi gui"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay nguoi nhan"));

        if (blockUserRepository.existsByBlocker_IdAndBlocked_Id(senderId, receiverId)
                || blockUserRepository.existsByBlocker_IdAndBlocked_Id(receiverId, senderId)) {
            throw new RuntimeException("Khong the nhan tin voi nguoi dung nay");
        }

        String directKey = buildDirectKey(senderId, receiverId);
        return conversationRepository.findByDirectKey(directKey)
                .map(conversation -> new DirectConversationResolveResult(conversation, false))
                .orElseGet(() -> findAndBackfillLegacyDirectConversation(senderId, receiverId, directKey)
                        .map(conversation -> new DirectConversationResolveResult(conversation, false))
                        .orElseGet(() -> createDirectConversationSafely(senderId, receiver, directKey)));
    }

    @Override
    public String buildDirectKey(Long userId1, Long userId2) {
        long first = Math.min(userId1, userId2);
        long second = Math.max(userId1, userId2);
        return first + ":" + second;
    }

    private DirectConversationResolveResult createDirectConversationSafely(Long senderId, User receiver, String directKey) {
        try {
            return directConversationCreationService.create(senderId, receiver.getId(), directKey);
        } catch (DataIntegrityViolationException ex) {
            Conversation existing = conversationRepository.findByDirectKey(directKey)
                    .orElseThrow(() -> ex);
            return new DirectConversationResolveResult(existing, false);
        }
    }

    private Optional<Conversation> findAndBackfillLegacyDirectConversation(Long senderId, Long receiverId, String directKey) {
        return conversationRepository.findDirectConversationsByMemberIds(senderId, receiverId)
                .stream()
                .findFirst()
                .map(conversation -> backfillDirectKeyIfNeeded(conversation, directKey));
    }

    private Conversation backfillDirectKeyIfNeeded(Conversation conversation, String directKey) {
        if (conversation.getDirectKey() != null) {
            return conversation;
        }
        try {
            conversation.setType(ConversationType.DIRECT);
            conversation.setDirectKey(directKey);
            conversationRepository.flush();
            return conversation;
        } catch (DataIntegrityViolationException ex) {
            return conversationRepository.findByDirectKey(directKey)
                    .orElseThrow(() -> ex);
        }
    }
}
