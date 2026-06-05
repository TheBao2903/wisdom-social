/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.repository;/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

import iuh.fit.edu.backend.modules.conversation.constant.ConversationType;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByInviteToken(String inviteToken);
    Optional<Conversation> findByInviteTokenAndType(String inviteToken, ConversationType type);
    Optional<Conversation> findByDirectKey(String directKey);

    @Query("""
    SELECT c
    FROM Conversation c
    WHERE c.type = iuh.fit.edu.backend.modules.conversation.constant.ConversationType.DIRECT
      AND (SELECT COUNT(cmAll.id)
           FROM ConversationMember cmAll
           WHERE cmAll.conversation = c) = 2
      AND (SELECT COUNT(cmMatch.id)
           FROM ConversationMember cmMatch
           WHERE cmMatch.conversation = c
             AND (cmMatch.user.id = :userId1 OR cmMatch.user.id = :userId2)) = 2
    ORDER BY c.lastMessageAt DESC
""")
    List<Conversation> findDirectConversationsByMemberIds(
            @Param("userId1") Long userId1,
            @Param("userId2") Long userId2
    );

    @Query("""
    SELECT DISTINCT c
    FROM Conversation c
    LEFT JOIN FETCH c.members members
    LEFT JOIN FETCH members.user
    WHERE c.directKey IS NULL
      AND c.type = iuh.fit.edu.backend.modules.conversation.constant.ConversationType.DIRECT
      AND (SELECT COUNT(cmAll.id)
           FROM ConversationMember cmAll
           WHERE cmAll.conversation = c) = 2
    ORDER BY c.lastMessageAt DESC
""")
    List<Conversation> findLegacyDirectConversationsWithoutDirectKey();
}
