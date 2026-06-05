package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;

@Getter
@Setter
public class AddMemberWithInvitesRequest {
    @NotNull(message = "Danh sach thanh vien khong duoc null")
    private Set<Long> newMemberIds;

    @NotNull(message = "Danh sach nguoi nhan link moi khong duoc null")
    private Set<Long> inviteeUserIds;
}
