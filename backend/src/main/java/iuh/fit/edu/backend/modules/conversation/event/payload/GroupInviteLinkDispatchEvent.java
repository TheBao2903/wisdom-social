package iuh.fit.edu.backend.modules.conversation.event.payload;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Set;

@Getter
@RequiredArgsConstructor
public class GroupInviteLinkDispatchEvent {
    private final Long inviterId;
    private final Long conversationId;
    private final String inviteToken;
    private final Set<Long> inviteeUserIds;
}
