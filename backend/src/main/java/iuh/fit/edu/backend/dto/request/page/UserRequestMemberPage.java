package iuh.fit.edu.backend.dto.request.page;

import iuh.fit.edu.backend.constant.PageRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserRequestMemberPage {
    private long userId;
    private long pageId;
    private PageRole pageRole;
}
