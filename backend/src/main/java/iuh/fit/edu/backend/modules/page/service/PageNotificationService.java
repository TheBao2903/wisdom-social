package iuh.fit.edu.backend.modules.page.service;

import iuh.fit.edu.backend.modules.page.constant.MemberStatus;
import iuh.fit.edu.backend.modules.page.constant.PageRole;
import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.entity.PageMember;
import iuh.fit.edu.backend.modules.page.repository.PageMemberRepository;
import iuh.fit.edu.backend.modules.notification.constant.NotificationType;
import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.notification.event.payload.NotificationEvent;
import iuh.fit.edu.backend.modules.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Helper that turns page actions into persistent notifications (bell icon),
 * reusing the same NotificationEvent pipeline as posts/reactions/friends.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PageNotificationService {

    private final PageMemberRepository pageMemberRepository;
    private final NotificationService notificationService;

    /**
     * Notify every ADMIN/MODERATOR of the page (except the actor) about an action.
     * The actor's avatar is used as the notification image.
     */
    public void notifyAdmins(Page page, long actorId, NotificationType type, String content) {
        if (page == null) return;
        try {
            List<PageMember> admins = pageMemberRepository.findByPage_IdAndStatusAndRoleIn(
                    page.getId(), MemberStatus.ACTIVE, List.of(PageRole.ADMIN, PageRole.MODERATOR));

            for (PageMember admin : admins) {
                if (admin.getUser() == null || admin.getUser().getId() == null) continue;
                long adminId = admin.getUser().getId();
                if (adminId == actorId) continue; // don't notify the user who performed the action

                notificationService.createNotification(NotificationEvent.builder()
                        .recipientId(String.valueOf(adminId))
                        .actorIds(List.of(String.valueOf(actorId)))
                        .type(type)
                        .targetType(TargetType.PAGE)
                        .targetId(String.valueOf(page.getId()))
                        .content(content)
                        .build());
            }
        } catch (Exception e) {
            log.error("Failed to send page admin notification for page {}: {}", page.getId(), e.getMessage());
        }
    }

    /**
     * Notify a single user about a page-centric outcome (e.g. join approved, post approved).
     * The page avatar is used as the notification image.
     */
    public void notifyUser(long recipientId, long actorId, Page page, NotificationType type, String content) {
        if (page == null) return;
        try {
            notificationService.createNotification(NotificationEvent.builder()
                    .recipientId(String.valueOf(recipientId))
                    .actorIds(List.of(String.valueOf(actorId)))
                    .type(type)
                    .targetType(TargetType.PAGE)
                    .targetId(String.valueOf(page.getId()))
                    .content(content)
                    .imageUrl(page.getAvatarUrl())
                    .build());
        } catch (Exception e) {
            log.error("Failed to send page user notification for page {}: {}", page.getId(), e.getMessage());
        }
    }
}
