/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Data
public class CreateGroupRequest {
    private String name;
    private String imageUrl;

    @NotNull(message = "Danh sách thành viên không được null")
    @Size(min = 2, message = "Phải chọn ít nhất 2 người khác để tạo nhóm")
    private Set<Long> memberIds;
}
