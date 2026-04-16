/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Data
@Builder
public class CursorResponse<T> {
    private T data;                 // List<MessageResponse>
    private Instant nextCursor;     // createdAt của message cũ nhất

    private boolean hasMoreOlder; // Cờ cho phép cuộn lên
    private boolean hasMoreNewer; // Cờ cho phép cuộn xuống (Trở về hiện tại)

    private Map<Long, UserReferenceDTO> referenceUsers; // Chứa người đã rời nhóm

    @Data
    public static class UserReferenceDTO {
        private String nickname;
        private String avatar;

        public UserReferenceDTO(String nickname, String avatar) {
            this.nickname = nickname;
            this.avatar = avatar;
        }
    }
}
