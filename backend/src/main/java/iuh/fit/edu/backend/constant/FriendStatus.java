/*
 * @ (#) FriendStatus.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.constant;

/*
 * @description: Friend request status
 * @author: The Bao
 * @date: 2026-01-31
 * @version: 1.0
 */
public enum FriendStatus {
    PENDING,    // Đang chờ xác nhận
    ACCEPTED,   // Đã chấp nhận (là bạn bè)
    REJECTED,   // Đã từ chối
    BLOCKED     // Đã chặn
}
