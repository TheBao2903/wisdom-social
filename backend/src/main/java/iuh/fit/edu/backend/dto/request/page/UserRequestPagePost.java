package iuh.fit.edu.backend.dto.request.page;

import lombok.Data;

@Data
public class UserRequestPagePost {
    private long userId;
    private long pageId;
    private String postId;
}
