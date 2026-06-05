package iuh.fit.edu.backend.modules.page.dto.request;

import lombok.Data;

@Data
public class PageJoinRequest {
    private long userId;
    private long pageId;
    private String message;  // Optional message when requesting to join
}
