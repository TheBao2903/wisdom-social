package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Set;

@Data
public class CreateGroupWithInvitesRequest {
    private String name;
    private String imageUrl;

    @NotNull(message = "Danh sach thanh vien khong duoc null")
    private Set<Long> memberIds;

    @NotNull(message = "Danh sach nguoi nhan link moi khong duoc null")
    private Set<Long> inviteeUserIds;
}
