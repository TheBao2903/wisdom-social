/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.repository;

import iuh.fit.edu.backend.modules.chat.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Repository
public interface MessageRepository extends MongoRepository<Message, String>, MessageReactionRepository {
    // Lấy ra 20 tin nhắn mới nhất
    List<Message> findByConversationIdOrderByCreatedAtDesc(
            Long conversationId,
            Pageable pageable
    );

    Optional<Message> findByConversationIdAndSenderIdAndClientMessageId(
            Long conversationId,
            Long senderId,
            String clientMessageId
    );

    List<Message> findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            Long conversationId,
            Instant before,
            Pageable pageable
    );

    @Query("{ 'replyInfo.messageId' : ?0 }")
    @Update("{ '$set' : { 'replyInfo.content' : 'Tin nhắn đã được thu hồi' } }")
    void updateContentOfRepliedMessages(String messageId);

    Message findFirstByConversationIdAndDeletedForNotOrderByCreatedAtDesc(Long conversationId, Long userId);

    List<Message> findTop10ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(Long conversationId, Instant createdAt);

    List<Message> findTop11ByConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(Long conversationId, Instant createdAt);

    List<Message> findTop21ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(Long conversationId, Instant after);

    List<Message> findTop11ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(Long conversationId, Instant createdAt);
}
