/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.conversation.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
@Setter
public class AddMemberRequest {
    @NotNull(message = "Danh sách thành viên không được để trống")
    @Size(min = 1, message = "Phải chọn ít nhất 1 người để thêm vào nhóm")
    private Set<Long> newMemberIds;
}
