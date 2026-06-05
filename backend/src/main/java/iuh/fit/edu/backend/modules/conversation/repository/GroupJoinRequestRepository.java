package iuh.fit.edu.backend.modules.conversation.repository;

import iuh.fit.edu.backend.modules.conversation.constant.JoinRequestStatus;
import iuh.fit.edu.backend.modules.conversation.entity.GroupJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Long> {
    
    // Tìm các yêu cầu đang chờ duyệt của một nhóm
    List<GroupJoinRequest> findByConversationIdAndStatusOrderByCreatedAtDesc(Long conversationId, JoinRequestStatus status);

    List<GroupJoinRequest> findByConversationIdAndStatus(Long conversationId, JoinRequestStatus status);

    // Kiểm tra xem user đã có yêu cầu nào đang chờ duyệt ở nhóm này chưa
    boolean existsByConversationIdAndUserIdAndStatus(Long conversationId, Long userId, JoinRequestStatus status);

    Optional<GroupJoinRequest> findByConversationIdAndUserIdAndStatus(
            Long conversationId,
            Long userId,
            JoinRequestStatus status
    );
}
