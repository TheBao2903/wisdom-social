/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.repository;

import iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.entity.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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
    Optional<ConversationMember> findByConversation_IdAndUser_IdAndStatus(Long conversationId, Long userId, ConversationMemberStatus conversationMemberStatus);

    // Lay danh sach cuoc hoi thoai ma user tham gia (chỉ lấy những conversation chưa bị ẩn)
    @Query("""
    SELECT cm.conversation
    FROM ConversationMember cm
    WHERE cm.user.id = :userId
      AND cm.isHidden = false
      AND (
          cm.conversation.type <> iuh.fit.edu.backend.modules.conversation.constant.ConversationType.DIRECT
          OR cm.conversation.lastMessageId IS NOT NULL
      )
    ORDER BY cm.conversation.lastMessageAt DESC
""")
    List<Conversation> findConversationsByUserIdOrderByLastMessageAtDesc(
            @Param("userId") Long userId
    );

    // Trong ConversationMemberRepository.java
    @Query("SELECT cm FROM ConversationMember cm " +
            "JOIN FETCH cm.conversation c " +
            "JOIN FETCH c.members " +
            "WHERE cm.user.id = :userId AND cm.isHidden = false " +
            "AND (c.type <> iuh.fit.edu.backend.modules.conversation.constant.ConversationType.DIRECT " +
            "OR c.lastMessageId IS NOT NULL) " +
            "ORDER BY c.lastMessageAt DESC")
    List<ConversationMember> findActiveSidebarByUserId(@Param("userId") Long userId);

    @Query("SELECT cm FROM ConversationMember cm " +
            "JOIN FETCH cm.conversation c " +
            "JOIN FETCH c.members " +
            "WHERE cm.user.id = :userId AND cm.isHidden = false " +
            "AND cm.status = iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus.ACTIVE " +
            "AND (c.type <> iuh.fit.edu.backend.modules.conversation.constant.ConversationType.DIRECT " +
            "OR c.lastMessageId IS NOT NULL) " +
            "ORDER BY c.lastMessageAt DESC")
    List<ConversationMember> findForwardableSidebarByUserId(@Param("userId") Long userId);

    @Query("""
    SELECT DISTINCT cm
    FROM ConversationMember cm
    JOIN FETCH cm.conversation c
    LEFT JOIN FETCH c.members members
    LEFT JOIN FETCH members.user
    WHERE cm.user.id = :userId
      AND c.id IN :conversationIds
      AND cm.isHidden = false
      AND cm.status = iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus.ACTIVE
      AND (
          c.type <> iuh.fit.edu.backend.modules.conversation.constant.ConversationType.DIRECT
          OR c.lastMessageId IS NOT NULL
      )
""")
    List<ConversationMember> findActiveSidebarByUserIdAndConversationIds(
            @Param("userId") Long userId,
            @Param("conversationIds") Set<Long> conversationIds
    );

    // Lay ra danh sach member o trong mot cuoc hoi thoai
    List<ConversationMember> findByConversationIdAndUserIdIn(Long conversationId, Set<Long> userIds);

    @Query("SELECT cm.user.id FROM ConversationMember cm WHERE cm.conversation.id = :conversationId")
    Set<Long> findAllUserIdsByConversationId(@Param("conversationId") Long conversationId);

    // Lấy toàn bộ id hội thoại mà user là thành viên (bất kể trạng thái thành viên).
    // Dùng khi user bị khóa/mở khóa để invalidate cache & đẩy realtime cho các hội thoại đó.
    @Query("SELECT DISTINCT cm.conversation.id FROM ConversationMember cm WHERE cm.user.id = :userId")
    Set<Long> findConversationIdsByUserId(@Param("userId") Long userId);

    List<ConversationMember> findByConversation_IdInAndUser_IdIn(
            Set<Long> conversationIds,
            Set<Long> userIds
    );
    List<ConversationMember> findByConversation_Id(Long conversationId);

    // Tăng số tin nhắn chưa đọc cho tất cả các thành viên trong cuộc hội thoại (trừ người nhắn)
    @Modifying
    @Transactional
    @Query("""
    UPDATE ConversationMember cu
    SET cu.unreadCount = cu.unreadCount + 1
    WHERE cu.conversation.id = :conversationId
      AND cu.user.id != :senderId
      AND cu.status = iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus.ACTIVE
""")
    void incrementUnreadCount(@Param("conversationId") Long conversationId,
                              @Param("senderId") Long senderId);

    // Đánh dấu đã đọc (Reset về 0)
    @Modifying
    @Transactional
    @Query("UPDATE ConversationMember cu SET cu.unreadCount = 0 " +
            "WHERE cu.conversation.id = :conversationId AND cu.user.id = :userId")
    void resetUnreadCount(@Param("conversationId") Long conversationId,
                          @Param("userId") Long userId);

    // Reset isHidden về false khi có tin nhắn mới (để conversation hiện lại)
    // KHÔNG reset clearedAt - giữ nguyên để filter messages cũ
    @Modifying
    @Transactional
    @Query("UPDATE ConversationMember cm SET cm.isHidden = false " +
            "WHERE cm.conversation.id = :conversationId AND cm.isHidden = true " +
            "AND cm.status = iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus.ACTIVE")
    void unhideConversationForAllMembers(@Param("conversationId") Long conversationId);

    @Query("""
    SELECT cm.user.id
    FROM ConversationMember cm
    WHERE cm.conversation.id = :conversationId
      AND cm.status = :status
""")
    Set<Long> findUserIdsByConversationIdAndStatus(
            @Param("conversationId") Long conversationId,
            @Param("status") ConversationMemberStatus status
    );

    long countByConversationIdAndStatus(Long convId, ConversationMemberStatus ConversationMemberStatus);

    List<ConversationMember> findByConversationIdAndStatus(Long conversationId, ConversationMemberStatus ConversationMemberStatus);

   Optional<ConversationMember> findByConversation_IdAndUser_Id(Long conversationId, Long userId);

    List<ConversationMember> findByConversationIdAndStatusOrderByBlockedAtDesc(Long conversationId, ConversationMemberStatus status);

    @Query("SELECT cm.user.id FROM ConversationMember cm WHERE cm.conversation.id = :conversationId AND cm.status = 'ACTIVE' AND cm.role IN ('OWNER', 'DEPUTY')")
    Set<Long> findAdminIdsByConversationId(@Param("conversationId") Long conversationId);

    int countByConversation_IdAndStatus(Long id, ConversationMemberStatus conversationMemberStatus);

    @Query("""
    SELECT COUNT(DISTINCT c.id)
    FROM Conversation c
    JOIN c.members cm1
    JOIN c.members cm2
    WHERE c.type = iuh.fit.edu.backend.modules.conversation.constant.ConversationType.GROUP
      AND cm1.user.id = :userId1
      AND cm2.user.id = :userId2
      AND cm1.status = iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus.ACTIVE
      AND cm2.status = iuh.fit.edu.backend.modules.conversation.constant.ConversationMemberStatus.ACTIVE
""")
    long countCommonActiveGroups(@Param("userId1") Long userId1, @Param("userId2") Long userId2);
}
