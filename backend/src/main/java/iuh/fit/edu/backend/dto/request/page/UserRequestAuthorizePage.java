package iuh.fit.edu.backend.dto.request.page;

import iuh.fit.edu.backend.constant.PageRole;
import lombok.Data;

@Data
public class UserRequestAuthorizePage {
    private long userId;
    private long pageId;
    private PageRole pageRole;
}
