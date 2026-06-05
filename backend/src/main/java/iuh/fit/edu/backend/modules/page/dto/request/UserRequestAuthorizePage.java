package iuh.fit.edu.backend.modules.page.dto.request;

import iuh.fit.edu.backend.modules.page.constant.PageRole;
import lombok.Data;

@Data
public class UserRequestAuthorizePage {
    private long userId;
    private long pageId;
    private PageRole pageRole;
}
