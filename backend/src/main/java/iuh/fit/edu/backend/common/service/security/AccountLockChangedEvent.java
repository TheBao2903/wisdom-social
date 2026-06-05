/*
 * @ (#) AccountLockChangedEvent.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.service.security;

import lombok.Getter;

/*
 * @description
 * Spring application event được bắn ra mỗi khi trạng thái khóa tài khoản của user
 * thay đổi (khóa/mở khóa). Các module khác (vd: conversation) lắng nghe để
 * invalidate cache & đẩy realtime cập nhật cho những user khác cùng hội thoại.
 *
 * Đây là event nội bộ trong tiến trình (in-process), KHÔNG phải Redis envelope.
 * @author: Huu Thai
 * @version: 1.0
 */
@Getter
public class AccountLockChangedEvent {
    private final Long userId;
    private final boolean locked;

    public AccountLockChangedEvent(Long userId, boolean locked) {
        this.userId = userId;
        this.locked = locked;
    }
}
