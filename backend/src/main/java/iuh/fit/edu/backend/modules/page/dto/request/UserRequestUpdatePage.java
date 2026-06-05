package iuh.fit.edu.backend.modules.page.dto.request;

import iuh.fit.edu.backend.modules.page.constant.PageStatus;
import iuh.fit.edu.backend.modules.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserRequestUpdatePage {
    private String name;
    private String username;
    private String category;
    private String description;
    private String avatarUrl;
    private String coverUrl;
    private String phone;
    private String email;
    private String website;
    private String address;
    private Boolean isVerified;
    private PageStatus status;
    private User createdBy;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
