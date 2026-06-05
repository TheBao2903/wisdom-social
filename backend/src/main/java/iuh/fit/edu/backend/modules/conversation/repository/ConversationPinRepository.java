package iuh.fit.edu.backend.modules.conversation.repository;

import iuh.fit.edu.backend.modules.conversation.entity.ConversationPin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationPinRepository extends JpaRepository<ConversationPin, Long> {
    long countByUser_Id(Long userId);

    Optional<ConversationPin> findByUser_IdAndConversationRefId(Long userId, Long conversationId);

    boolean existsByUser_IdAndConversationRefId(Long userId, Long conversationId);

    void deleteByUser_IdAndConversationRefId(Long userId, Long conversationId);

    List<ConversationPin> findByUser_IdOrderByPinnedAtDesc(Long userId);
}
