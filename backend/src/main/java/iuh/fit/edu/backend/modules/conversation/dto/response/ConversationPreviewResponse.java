package iuh.fit.edu.backend.modules.conversation.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConversationPreviewResponse {
    private Long conversationId;
    private String name;
    private String imageUrl;
    private int memberCount;
    private boolean isJoinApprovalRequired;
    
    /**
     * Trạng thái người dùng hiện tại:
     * 'ACTIVE': Đã là thành viên (FE nên cho nhảy thẳng vào chat)
     * 'PENDING': Đang chờ duyệt (FE nên hiển thị nút "Đang chờ duyệt" disable)
     * 'NOT_MEMBER': Người lạ (FE hiện Modal Preview kèm nút "Tham gia")
     */
    private String userStatus; 
}