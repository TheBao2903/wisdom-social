/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.Conversation;
import iuh.fit.edu.backend.domain.entity.mysql.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Repository
public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {
    Optional<ConversationMember> findByConversation_IdAndUser_Id(Long conversationId, Long userId);

    // Lay danh sach cuoc hoi thoai ma user tham gia (chỉ lấy những conversation chưa bị ẩn)
    @Query("""
    SELECT cm.conversation
    FROM ConversationMember cm
    WHERE cm.user.id = :userId AND cm.isHidden = false
    ORDER BY cm.conversation.lastMessageAt DESC
""")
    List<Conversation> findConversationsByUserIdOrderByLastMessageAtDesc(
            @Param("userId") Long userId
    );

    // Lay ra danh sach member o trong mot cuoc hoi thoai
    List<ConversationMember> findByConversationIdAndUserIdIn(Long conversationId, Set<Long> userIds);

    @Query("SELECT cm.user.id FROM ConversationMember cm WHERE cm.conversation.id = :conversationId")
    Set<Long> findAllUserIdsByConversationId(@Param("conversationId") Long conversationId);

    List<ConversationMember> findByConversation_IdInAndUser_IdIn(
            Set<Long> conversationIds,
            Set<Long> userIds
    );
    List<ConversationMember> findByConversation_Id(Long conversationId);

    // Tăng số tin nhắn chưa đọc cho tất cả các thành viên trong cuộc hội thoại (trừ người nhắn)
    @Modifying
    @Query("UPDATE ConversationMember cu SET cu.unreadCount = cu.unreadCount + 1 " +
            "WHERE cu.conversation.id = :conversationId AND cu.user.id != :senderId")
    void incrementUnreadCount(@Param("conversationId") Long conversationId,
                              @Param("senderId") Long senderId);

    // Đánh dấu đã đọc (Reset về 0)
    @Modifying
    @Query("UPDATE ConversationMember cu SET cu.unreadCount = 0 " +
            "WHERE cu.conversation.id = :conversationId AND cu.user.id = :userId")
    void resetUnreadCount(@Param("conversationId") Long conversationId,
                          @Param("userId") Long userId);

    // Reset isHidden về false khi có tin nhắn mới (để conversation hiện lại)
    // KHÔNG reset clearedAt - giữ nguyên để filter messages cũ
    @Modifying
    @Query("UPDATE ConversationMember cm SET cm.isHidden = false " +
            "WHERE cm.conversation.id = :conversationId AND cm.isHidden = true")
    void unhideConversationForAllMembers(@Param("conversationId") Long conversationId);
}
