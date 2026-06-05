package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.FriendRequest;
import iuh.fit.edu.backend.modules.user.dto.request.*;
import iuh.fit.edu.backend.modules.user.dto.response.*;
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
    void resendConfirmationOtp(String phone);
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
    void logoutAllDevices(User user);
    void requestAccountDeletion(User user);
    void cancelAccountDeletion(User user);

    void setupPinCode(User user, String pinCode);
    boolean verifyPinCode(User user, String pinCode);
    void removePinCode(User user);

    @Transactional
    Instant updateLastActiveAt(Long userId);

    PaginatedUserResponse searchMentionUsers(long viewerId, String keyword, int page, int size);
}
