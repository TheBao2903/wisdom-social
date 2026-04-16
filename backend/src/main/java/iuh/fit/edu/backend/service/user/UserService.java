package iuh.fit.edu.backend.service.user;

import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.friend.FriendRequest;
import iuh.fit.edu.backend.dto.request.user.*;
import iuh.fit.edu.backend.dto.response.user.*;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.List;


public interface UserService {
    UserResponseRegister registerUser(UserRequestRegister register);
    UserResponseConfirmRegister confirmRegisterUser(UserRequestConfirmRegister confirm);
    UserResponseLogin loginUser(UserRequestLogin login);
    void logoutUser(String idToken, String refreshToken);
    User getCurrentUser();
    String getNewAccessToken(String refreshToken);
    String getNewQrAccessToken(String refreshToken);
    UserResponseOTPPassword forgotPasswordUser(UserRequestForgotPassword requestForgotPassword);
    boolean resetPassword(UserRequestResetPassword requestResetPassword);
    boolean deleteUser(long id);
    boolean updateUser(long id, UserRequestUpdate requestUpdate);
    List<User> getAllUser();
    User findUserById(long id);
    List<User> getAllForUser(long id);
    List<User> getAllBlockUser(long id);
    boolean saveBlockUser(FriendRequest friendRequest);
    boolean cancelBlockUser(FriendRequest friendRequest);
    List<User> searchUserByUsername(String keyword);
    void saveDevice(User user, String deviceType, String deviceName, String ipAddress);

    // Hàm cập nhật lần hoạt động cuối cùng user
    @Transactional
    Instant updateLastActiveAt(Long userId);
}
