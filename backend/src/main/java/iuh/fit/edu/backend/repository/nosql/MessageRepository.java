/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.domain.entity.nosql.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Repository
public interface MessageRepository extends MongoRepository<Message, String> {
    // Lấy ra 20 tin nhắn mới nhất
    List<Message> findByConversationIdOrderByCreatedAtDesc(
            Long conversationId,
            Pageable pageable
    );

    List<Message> findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            Long conversationId,
            Instant before,
            Pageable pageable
    );

    @Query("{ 'replyInfo.messageId' : ?0 }")
    @Update("{ '$set' : { 'replyInfo.content' : 'Tin nhắn đã được thu hồi' } }")
    void updateContentOfRepliedMessages(String messageId);



    List<Message> findTop10ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(Long conversationId, Instant createdAt);

    List<Message> findTop11ByConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(Long conversationId, Instant createdAt);

    List<Message> findTop21ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(Long conversationId, Instant after);

    List<Message> findTop11ByConversationIdAndCreatedAtAfterOrderByCreatedAtAsc(Long conversationId, Instant createdAt);
}
