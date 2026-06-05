/*
 * @ (#) AccountLockConversationSyncListener.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.event.handler;

import iuh.fit.edu.backend.common.service.security.AccountLockChangedEvent;
import iuh.fit.edu.backend.modules.conversation.event.payload.MemberAccountLockChangedEvent;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationMemberRepository;
import iuh.fit.edu.backend.modules.conversation.service.ConversationMemberCacheService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.HashSet;
import java.util.Set;

/*
 * @description
 * Khi tài khoản 1 user bị khóa/mở khóa, listener này:
 *   1) Xóa cache members (Redis) của tất cả hội thoại user đó tham gia -> lần đọc kế tiếp
 *      sẽ nạp lại accountLocked mới nhất từ DB, tránh UI hiển thị sai do cache cũ.
 *   2) Đẩy realtime MemberAccountLockChangedEvent tới từng hội thoại để các user khác
 *      đang mở hội thoại chung cập nhật ngay (mask/bỏ mask tên + avatar).
 *
 * Chạy AFTER_COMMIT để đảm bảo trạng thái User.locked đã được commit trước khi
 * evict cache & broadcast (tránh client refetch lại dữ liệu cũ rồi cache lại).
 * fallbackExecution = true để vẫn chạy nếu sự kiện được bắn ngoài transaction.
 * @author: Huu Thai
 * @version: 1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AccountLockConversationSyncListener {

    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationMemberCacheService conversationMemberCacheService;
    private final ApplicationEventPublisher eventPublisher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountLockChanged(AccountLockChangedEvent event) {
        handle(event.getUserId(), event.isLocked());
    }

    // Một số luồng (vd: auto-unlock trong isLocked) có thể chạy ngoài transaction quản lý;
    // @TransactionalEventListener với fallbackExecution=true vẫn xử lý qua nhánh trên.
    private void handle(Long userId, boolean locked) {
        if (userId == null) return;

        Set<Long> conversationIds = conversationMemberRepository.findConversationIdsByUserId(userId);
        if (conversationIds == null || conversationIds.isEmpty()) return;

        log.info("Sync account lock (userId={}, locked={}) across {} conversation(s)",
                userId, locked, conversationIds.size());

        for (Long conversationId : conversationIds) {
            // 1) Vô hiệu hóa cache để lần đọc sau nạp lại accountLocked mới
            conversationMemberCacheService.evictConversation(conversationId);

            // 2) Các thành viên khác trong hội thoại -> nhận cập nhật SIDEBAR realtime.
            Set<Long> recipients = new HashSet<>(
                    conversationMemberRepository.findAllUserIdsByConversationId(conversationId));
            recipients.remove(userId); // bản thân user bị khóa đã bị force-logout

            // 3) Báo realtime: kênh members (người đang mở hội thoại) + kênh
            //    conversations của từng recipient (cập nhật sidebar dù không mở).
            eventPublisher.publishEvent(
                    new MemberAccountLockChangedEvent(
                            conversationId, userId, locked, recipients));
        }
    }
}
