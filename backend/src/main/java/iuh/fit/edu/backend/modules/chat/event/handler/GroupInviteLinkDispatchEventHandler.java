package iuh.fit.edu.backend.modules.chat.event.handler;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;
import iuh.fit.edu.backend.modules.chat.dto.request.SendMessageRequest;
import iuh.fit.edu.backend.modules.chat.service.MessageService;
import iuh.fit.edu.backend.modules.conversation.event.payload.GroupInviteLinkDispatchEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class GroupInviteLinkDispatchEventHandler {
    private final MessageService messageService;

    @Value("${app.web-url:http://localhost:5173}")
    private String webUrl;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handle(GroupInviteLinkDispatchEvent event) {
        if (event.getInviteeUserIds() == null || event.getInviteeUserIds().isEmpty()) {
            return;
        }

        String inviteUrl = buildInviteUrl(event.getInviteToken());
        for (Long inviteeUserId : event.getInviteeUserIds()) {
            if (inviteeUserId == null || inviteeUserId.equals(event.getInviterId())) {
                continue;
            }

            SendMessageRequest request = new SendMessageRequest();
            request.setReceiverId(inviteeUserId);
            request.setType(MessageType.LINK);
            request.setContent(inviteUrl);
            try {
                messageService.sendMessage(request, event.getInviterId());
            } catch (Exception ex) {
                log.error(
                        "Failed to send group invite link to user {} for conversation {}",
                        inviteeUserId,
                        event.getConversationId(),
                        ex
                );
            }
        }
    }

    private String buildInviteUrl(String token) {
        String baseUrl = webUrl == null || webUrl.isBlank()
                ? "http://localhost:5173"
                : webUrl.replaceAll("/+$", "");
        return baseUrl + "/g/" + token;
    }
}
