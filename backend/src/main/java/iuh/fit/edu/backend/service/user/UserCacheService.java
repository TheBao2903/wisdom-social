/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.user;/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */

public interface UserCacheService {
    // Thêm Session khi user mở thiết bị. Trả về true nếu là thiết bị đầu tiên (Mới online)
    boolean addOnlineSession(Long userId, String sessionId);

    // Rút Session khi user tắt thiết bị. Trả về true nếu là thiết bị cuối cùng (Chính thức offline)
    boolean removeOnlineSession(Long userId, String sessionId);

    // Kiểm tra nhanh xem user có đang online không (Dùng cho hàm Init API)
    boolean isUserOnline(Long userId);
}
