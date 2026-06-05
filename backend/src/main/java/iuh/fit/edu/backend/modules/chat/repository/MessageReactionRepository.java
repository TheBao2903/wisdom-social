package iuh.fit.edu.backend.modules.chat.repository;

import iuh.fit.edu.backend.modules.chat.entity.Message;

import java.util.Optional;

public interface MessageReactionRepository {
    Optional<Message> incrementReactionCounter(String messageId, Long userId, String emoji);
}
