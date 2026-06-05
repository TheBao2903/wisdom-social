package iuh.fit.edu.backend.modules.page.dto.request;

import lombok.Data;

@Data
public class UserRequestPagePost {
    private long userId;
    private long pageId;
    private String postId;
}
