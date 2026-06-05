/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.modules.user.constant.FriendStatus;
import iuh.fit.edu.backend.modules.user.dto.request.FriendRequest;
import iuh.fit.edu.backend.modules.user.dto.request.*;
import iuh.fit.edu.backend.modules.user.dto.response.BlockEventPayload;
import iuh.fit.edu.backend.modules.user.dto.response.*;
import iuh.fit.edu.backend.common.config.JwtAuthFilter;
import iuh.fit.edu.backend.modules.user.mapper.UserMapper;
import iuh.fit.edu.backend.modules.user.entity.*;
import iuh.fit.edu.backend.modules.user.repository.ActiveTokenRepository;
import iuh.fit.edu.backend.modules.user.repository.BlackListUserRepository;
import iuh.fit.edu.backend.modules.user.repository.DeviceRepository;
import iuh.fit.edu.backend.modules.user.repository.FriendRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.repository.UserSettingRepository;
import iuh.fit.edu.backend.modules.conversation.entity.Conversation;
import iuh.fit.edu.backend.modules.conversation.event.payload.DirectBlockStatusChangedEvent;
import iuh.fit.edu.backend.modules.conversation.repository.ConversationRepository;
import iuh.fit.edu.backend.modules.conversation.service.DirectConversationService;
import iuh.fit.edu.backend.modules.user.entity.UserSetting;
import iuh.fit.edu.backend.common.exception.AccountLockedException;
import iuh.fit.edu.backend.common.exception.RateLimitExceededException;
import iuh.fit.edu.backend.common.service.security.AccountLockService;
import iuh.fit.edu.backend.common.service.security.RateLimitService;
import iuh.fit.edu.backend.modules.user.service.BlockUserService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.*;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Ngoc Hai
 * @date:
 * @version: 1.0
 */
@Service
public class UserServiceImpl implements UserService {
    @Value("${aws.cognito.clientId}")
    private String userClientId;
    @Value("${aws.cognito.userPoolId}")
    private String userPoolId;

    UserMapper userMapper;
    UserRepository userRepository;
    BlackListUserRepository blackListUserRepository;
    BlockUserService blockUserService;
    CognitoIdentityProviderClient cognitoClient;
    SimpMessagingTemplate simpMessagingTemplate;
    DeviceRepository deviceRepository;
    ActiveTokenRepository activeTokenRepository;
    RateLimitService rateLimitService;
    AccountLockService accountLockService;
    FriendRepository friendRepository;
    UserSettingRepository userSettingRepository;
    StringRedisTemplate redisTemplate;
    ConversationRepository conversationRepository;
    DirectConversationService directConversationService;
    ApplicationEventPublisher eventPublisher;


    public UserServiceImpl(BlackListUserRepository blackListUserRepository,
                           BlockUserService blockUserService, CognitoIdentityProviderClient cognitoClient,
                           UserMapper userMapper, UserRepository userRepository,
                           SimpMessagingTemplate simpMessagingTemplate,
                           DeviceRepository deviceRepository,
                           ActiveTokenRepository activeTokenRepository,
                            RateLimitService rateLimitService,
                            AccountLockService accountLockService,
                            FriendRepository friendRepository,
                            UserSettingRepository userSettingRepository,
                            StringRedisTemplate redisTemplate,
                            ConversationRepository conversationRepository,
                            DirectConversationService directConversationService,
                            ApplicationEventPublisher eventPublisher
                            ) {
        this.blackListUserRepository = blackListUserRepository;
        this.blockUserService = blockUserService;
        this.cognitoClient = cognitoClient;
        this.userMapper = userMapper;
        this.userRepository = userRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.deviceRepository = deviceRepository;
        this.activeTokenRepository = activeTokenRepository;
        this.rateLimitService = rateLimitService;
        this.accountLockService = accountLockService;
        this.friendRepository = friendRepository;
        this.userSettingRepository = userSettingRepository;
        this.redisTemplate = redisTemplate;
        this.conversationRepository = conversationRepository;
        this.directConversationService = directConversationService;
        this.eventPublisher = eventPublisher;
    }

    /*Đăng kí tài khoản bằng aws cognito
    * @params
    * phone:số điện thoại người dùng
    * password:
    * confirmPassword:
    * */
    @Override
    @Transactional
    public UserResponseRegister registerUser(UserRequestRegister register) {
        if(register.getPassword().equals(register.getConfirmPassword())){
            String phone="+84"+register.getPhone().substring(1,10);
            User user=userMapper.UserRegistertoUser(register);
            User temp=userRepository.findByPhone(user.getPhone());

            if(user!=null){
                String username=randomUsernameGenerator();
                if (userRepository.existsUserByUsername(username)){
                    username=randomUsernameGenerator();
                }
                user.setUsername(username);
                user.setName("Không rõ");
                SignUpRequest request=SignUpRequest.builder()
                        .clientId(userClientId)
                        .username(phone)
                        .password(register.getPassword())
                        .userAttributes(
                                AttributeType.builder()
                                        .name("phone_number")
                                        .value(phone)
                                        .build()
                        )
                        .build();
                if (checkUserStatus(phone)){
                    AdminDeleteUserRequest deleteRequest = AdminDeleteUserRequest.builder()
                            .userPoolId(userPoolId)
                            .username(phone)
                            .build();
                    cognitoClient.adminDeleteUser(deleteRequest);
                    if(temp!=null && temp.getPhone().equals(user.getPhone())){
                        deviceRepository.deleteDeviceByUser_Id(temp.getId());
                        userRepository.deleteById(temp.getId());
                    }
                }

                cognitoClient.signUp(request);
                userRepository.save(user);
                saveDevice(user, register.getDeviceType(), register.getDeviceName(), register.getIpAddress());
                return userMapper.UsertoUserRegisterResponse(user);

            }
        }
        return null;
    }

    @Override
    public UserResponseConfirmRegister confirmRegisterUser(UserRequestConfirmRegister confirm) {
        long otpLock = rateLimitService.checkOtpLock(confirm.getPhone());
        if (otpLock > 0) {
            throw new RateLimitExceededException(otpLock);
        }

        String phone = "+84" + confirm.getPhone().substring(1, 10);

        System.out.println("Confirming registration for phone: " + phone + " with OTP: " + confirm.getOtp());
        ConfirmSignUpRequest request = ConfirmSignUpRequest.builder()
                .clientId(userClientId)
                .username(phone)
                .confirmationCode(confirm.getOtp())
                .build();

        try {
            ConfirmSignUpResponse response = cognitoClient.confirmSignUp(request);
            if (response != null) {
                rateLimitService.clearOtpAttempts(confirm.getPhone());

                // Gán tài khoản mới vào nhóm USER để token có claim cognito:groups=[USER].
                // ADMIN được cấp thủ công trong Cognito console.
                try {
                    cognitoClient.adminAddUserToGroup(AdminAddUserToGroupRequest.builder()
                            .userPoolId(userPoolId)
                            .username(phone)
                            .groupName("USER")
                            .build());
                } catch (Exception ex) {
                    System.err.println("Could not add user to USER group: " + ex.getMessage());
                }

                return UserResponseConfirmRegister.builder()
                        .status(true)
                        .build();
            }
            return null;
        } catch (CodeMismatchException e) {
            long lockSec = rateLimitService.recordFailedOtp(confirm.getPhone());
            if (lockSec > 0) {
                throw new RateLimitExceededException(lockSec);
            }
            throw new RuntimeException("Invalid confirmation code: " + e.getMessage());
        } catch (ExpiredCodeException e) {
            throw new RuntimeException("Confirmation code expired: " + e.getMessage());
        }
    }

    @Override
    public UserResponseLogin loginUser(UserRequestLogin login) {
        String ip = login.getIpAddress() != null ? login.getIpAddress() : "unknown";

        // Check rate limit lock
        long lockRemaining = rateLimitService.checkLoginLock(login.getPhone(), ip);
        if (lockRemaining > 0) {
            throw new RateLimitExceededException(lockRemaining);
        }

        // Check account lock
        User user = userRepository.findByPhone(login.getPhone());
        if (user != null && accountLockService.isLocked(user)) {
            long remainSec = accountLockService.getRemainingLockSeconds(user);
            throw new AccountLockedException(remainSec, user.getLockReason());
        }

        String phone = "+84" + login.getPhone().substring(1, 10);
        Map<String, String> authParams = new HashMap<>();
        authParams.put("USERNAME", phone);
        authParams.put("PASSWORD", login.getPassword());

        InitiateAuthRequest request = InitiateAuthRequest.builder()
                .clientId(userClientId)
                .authFlow(AuthFlowType.USER_PASSWORD_AUTH)
                .authParameters(authParams)
                .build();

        try {
            InitiateAuthResponse response = cognitoClient.initiateAuth(request);
            AuthenticationResultType resultType = response.authenticationResult();

            if (resultType != null) {
                rateLimitService.clearLoginAttempts(login.getPhone(), ip);

                String accessToken = resultType.accessToken();
                String refreshToken = resultType.refreshToken();
                String idToken = resultType.idToken();
                if (user == null) {
                    user = userRepository.findByPhone(login.getPhone());
                }

                // 1 PHIÊN MỖI NỀN TẢNG: trước khi tạo phiên mới, chỉ thu hồi + đẩy
                // FORCE_LOGOUT tới các phiên cũ CÙNG nền tảng (web đá web, mobile đá
                // mobile). Nhờ vậy 1 web + 1 mobile vẫn đăng nhập song song được.
                // Thiết bị mới chưa subscribe nên không bị ảnh hưởng bởi broadcast này.
                String platform = resolvePlatform(login.getDeviceType());
                logoutPlatformSessions(user, platform);

                saveDevice(user, login.getDeviceType(), login.getDeviceName(), login.getIpAddress());

                activeTokenRepository.save(ActiveToken.builder()
                        .userId(user.getId())
                        .accessToken(accessToken)
                        .refreshToken(refreshToken)
                        .idToken(idToken)
                        .platform(platform)
                        .createdAt(OffsetDateTime.now())
                        .expiresAt(OffsetDateTime.now().plusHours(1))
                        .build());

                UserResponseLogin.UserResponseLoginBuilder builder = UserResponseLogin.builder()
                        .id(user.getId())
                        .phone(user.getPhone())
                        .username(user.getUsername())
                        .name(user.getName())
                        .avatarUrl(user.getAvatarUrl())
                        .bio(user.getBio())
                        .gender(user.getGender())
                        .birthday(user.getBirthday())
                        .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().toInstant() : null)
                        .token(accessToken)
                        .refreskToken(refreshToken)
                        .idToken(idToken)
                        .hasPinCode(user.hasPinCode());

                if (user.getDeletionRequestedAt() != null) {
                    long remainingDays = ChronoUnit.DAYS.between(OffsetDateTime.now(), user.getDeletionScheduledFor());
                    builder.deletionPending(true)
                            .deletionRemainingDays(Math.max(remainingDays, 0))
                            .deletionScheduledFor(user.getDeletionScheduledFor() != null ? user.getDeletionScheduledFor().toInstant() : null);
                }

                return builder.build();
            }
            return null;
        } catch (NotAuthorizedException e) {
            long lockSec = rateLimitService.recordFailedLogin(login.getPhone(), ip);
            if (lockSec > 0 && user != null) {
                accountLockService.systemLock(user, "Nhập sai mật khẩu quá nhiều lần", 15);
            }
            if (lockSec > 0) {
                throw new RateLimitExceededException(lockSec);
            }
            throw new RuntimeException("Incorrect username or password");
        }
    }

    @Override
    public void logoutUser(String idToken, String refreshToken) {
        BlackListUser blackListUser=BlackListUser.builder()
                .idToken(idToken)
                .refreshToken(refreshToken)
                .build();
        blackListUserRepository.save(blackListUser);
    }
    @Override
    public void saveDevice(User user, String deviceType, String deviceName, String ipAddress) {
        if (user == null) return;
        Device device = new Device();
        device.setUser(user);
        device.setDeviceType(deviceType != null ? deviceType : "UNKNOWN");
        device.setNameDevice(deviceName != null ? deviceName : "UNKNOWN");
        device.setIpAddress(ipAddress != null ? ipAddress : "UNKNOWN");
        device.setCreateAt(OffsetDateTime.now());
        deviceRepository.save(device);
    }

    @Override
    public User getCurrentUser() {
        Authentication auth = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (auth == null || auth.getPrincipal() == null) {
            return null;
        }

        try {
            String phone = auth.getPrincipal().toString();

            // Normalize phone (+84 -> 0)
            if (phone.startsWith("+84")) {
                phone = "0" + phone.substring(3);
            }

            User user = userRepository.findByPhone(phone);
            if (user != null && auth.getAuthorities() != null) {
                // Trả về vai trò (bỏ tiền tố ROLE_) để frontend phân quyền: ADMIN, USER
                List<String> roles = auth.getAuthorities().stream()
                        .map(a -> a.getAuthority().replaceFirst("^ROLE_", ""))
                        .toList();
                user.setRoles(roles);
            }
            return user;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public String getNewAccessToken(String refreshToken) {

        if (refreshToken == null || refreshToken.isBlank()
                || blackListUserRepository.existsByAnyToken(refreshToken)) {
            // Phải THROW (không return chuỗi với HTTP 200) để controller trả 401.
            // Nếu return "Refresh token revoked" với status 200, frontend sẽ tưởng
            // đó là access token hợp lệ (chuỗi > 20 ký tự) -> không đăng xuất ->
            // user bị admin khóa vẫn kẹt lại trong app mà không bị văng.
            throw new RuntimeException("Refresh token revoked");
        }

        Map<String, String> authParams = new HashMap<>();
        authParams.put("REFRESH_TOKEN", refreshToken);
        InitiateAuthRequest request=InitiateAuthRequest.builder()
                .authFlow(AuthFlowType.REFRESH_TOKEN_AUTH)
                .clientId(userClientId)
                .authParameters(authParams)
                .build();

        InitiateAuthResponse response=cognitoClient.initiateAuth(request);
        AuthenticationResultType resultType=response.authenticationResult();


        if (resultType == null || resultType.accessToken() == null) {
            throw new RuntimeException("Refresh token invalid or expired");
        }
        return resultType.accessToken();
    }

    @Override
    public String getNewQrAccessToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new RuntimeException("QR refresh token is missing");
        }

        if (blackListUserRepository.existsByAnyToken(refreshToken)) {
            throw new RuntimeException("Refresh token revoked");
        }

        var decoded = JwtAuthFilter.verifyLocalToken(refreshToken);
        String phone = decoded.getClaim("phone_number").asString();

        if (phone == null || phone.isBlank()) {
            throw new RuntimeException("Invalid QR refresh token");
        }

        return JwtAuthFilter.generateToken(phone);
    }

    @Override
    public void resendConfirmationOtp(String phone) {
        String formattedPhone = "+84" + phone.substring(1, 10);
        System.out.println("Test resend OTP:"+phone);
        try {
            ResendConfirmationCodeRequest request = ResendConfirmationCodeRequest.builder()
                    .clientId(userClientId)
                    .username(formattedPhone)
                    .build();
            cognitoClient.resendConfirmationCode(request);
        } catch (Exception e) {
            throw new RuntimeException("Failed to resend OTP: " + e.getMessage());
        }
    }

    @Override
    public UserResponseOTPPassword forgotPasswordUser(UserRequestForgotPassword requestForgotPassword) {
        String phone = "+84" + requestForgotPassword.getPhone().substring(1, 10);
        
        try {
            ForgotPasswordRequest request = ForgotPasswordRequest.builder()
                    .clientId(userClientId)
                    .username(phone)
                    .build();
            
            ForgotPasswordResponse response = cognitoClient.forgotPassword(request);
            
            if (response != null) {
                UserResponseOTPPassword responseOTP = new UserResponseOTPPassword();
                responseOTP.setOTP("OTP sent to " + requestForgotPassword.getPhone());
                return responseOTP;
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to send OTP: " + e.getMessage());
        }
        
        return null;
    }

    @Override
    @Transactional
    public boolean resetPassword(UserRequestResetPassword requestResetPassword) {
        long otpLock = rateLimitService.checkOtpLock(requestResetPassword.getPhone());
        if (otpLock > 0) {
            throw new RateLimitExceededException(otpLock);
        }

        if (!requestResetPassword.getPassword().equals(requestResetPassword.getConfirmPassword())) {
            throw new RuntimeException("Password and confirm password do not match");
        }

        String phone = "+84" + requestResetPassword.getPhone().substring(1, 10);

        try {
            ConfirmForgotPasswordRequest request = ConfirmForgotPasswordRequest.builder()
                    .clientId(userClientId)
                    .username(phone)
                    .confirmationCode(requestResetPassword.getConfirmationCode())
                    .password(requestResetPassword.getPassword())
                    .build();

            ConfirmForgotPasswordResponse response = cognitoClient.confirmForgotPassword(request);

            if (response != null) {
                rateLimitService.clearOtpAttempts(requestResetPassword.getPhone());
                // Mật khẩu đã đổi -> đăng xuất tất cả thiết bị: thu hồi mọi token cũ
                // và đẩy FORCE_LOGOUT realtime để web/mobile đăng xuất ngay lập tức.
                // Bảo đảm ở phía server cho MỌI luồng reset (settings và quên mật khẩu),
                // kể cả khi client không/không thể gọi logout-all.
                User user = userRepository.findByPhone(requestResetPassword.getPhone());
                if (user != null) {
                    logoutAllDevices(user);
                }
                return true;
            }
            return false;
        } catch (CodeMismatchException e) {
            long lockSec = rateLimitService.recordFailedOtp(requestResetPassword.getPhone());
            if (lockSec > 0) {
                throw new RateLimitExceededException(lockSec);
            }
            throw new RuntimeException("Failed to reset password: Invalid code provided");
        } catch (ExpiredCodeException e) {
            throw new RuntimeException("Failed to reset password: Code expired");
        } catch (Exception e) {
            throw new RuntimeException("Failed to reset password: " + e.getMessage());
        }
    }

    @Override
    public boolean deleteUser(long id) {
        if(id>0){
            userRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean updateUser(long id, UserRequestUpdate requestUpdate) {
        if(id>0){
           User user=userRepository.findById(id).orElse(null);
           if(user!=null){
               if (requestUpdate.getName() != null) user.setName(requestUpdate.getName());
               if (requestUpdate.getBio() != null) user.setBio(requestUpdate.getBio());
               if (requestUpdate.getGender() != null) user.setGender(requestUpdate.getGender());
               if (requestUpdate.getAvatarUrl() != null) user.setAvatarUrl(requestUpdate.getAvatarUrl());
               if (requestUpdate.getBirthday() != null) user.setBirthday(requestUpdate.getBirthday());
               if (requestUpdate.getUsername() != null) user.setUsername(requestUpdate.getUsername());
               user.setUpdatedAt(OffsetDateTime.now());
               userRepository.save(user);

               if (requestUpdate.getPrivacyProfile() != null) {
                   UserSetting setting = userSettingRepository.findById(user.getId()).orElseGet(() -> {
                       UserSetting s = new UserSetting();
                       s.setUser(user);
                       return s;
                   });
                   setting.setPrivacyProfile(requestUpdate.getPrivacyProfile());
                   userSettingRepository.save(setting);
               }

               Map<String, Object> profileUpdatePayload = new HashMap<>();
               profileUpdatePayload.put("id", user.getId());
               profileUpdatePayload.put("username", user.getUsername());
               profileUpdatePayload.put("name", user.getName());
               profileUpdatePayload.put("bio", user.getBio());
               profileUpdatePayload.put("avatarUrl", user.getAvatarUrl());
               profileUpdatePayload.put("birthday", user.getBirthday());
               profileUpdatePayload.put("gender", user.getGender());
               profileUpdatePayload.put("phone", user.getPhone());
               
               // Send WebSocket notification to all users about profile update
               if (user.getPhone() != null) {
                   String userPhone = convertToInternationalFormat(user.getPhone());
                   System.out.println("🟢🟢🟢 PUBLISHING PROFILE UPDATE 🟢🟢🟢");
                   System.out.println("📱 User ID: " + id);
                   System.out.println("📱 Phone: " + user.getPhone());
                   System.out.println("📱 International Phone: " + userPhone);
                   System.out.println("📱 Topic: /topic/user/" + userPhone + "/profile-update");
                   System.out.println("📱 Payload: " + profileUpdatePayload);

                   // Send to friends/followers about user's profile update
                   simpMessagingTemplate.convertAndSend(
                       "/topic/user/" + userPhone + "/profile-update",
                        profileUpdatePayload
                   );

                   System.out.println("✅ Published to WebSocket topic");
               }
               
               return true;
           }
        }
        return false;
    }

    @Override
    public List<User> getAllUser() {
        return userRepository.findAll();
    }

    @Override
    public User findUserById(long id) {
        return userRepository.findById(id).orElse(null);
    }

    @Override
    public List<User> getAllForUser(long id) {
        List<User> allUser = getAllUser();
        User user = findUserById(id);

        // Get users that this user has blocked
        List<BlockedUser> blockedUsers = blockUserService.getBlockUser(user);
        Set<Long> blockedIds = blockedUsers.stream()
                .map(b -> b.getBlocked().getId())
                .collect(Collectors.toSet());

        // Get users that have blocked this user
        List<BlockedUser> blockedByUsers = blockUserService.getBlockedByUser(user);
        Set<Long> blockedByIds = blockedByUsers.stream()
                .map(b -> b.getBlocker().getId())
                .collect(Collectors.toSet());

        // Combine both sets and remove them from results
        blockedIds.addAll(blockedByIds);
        allUser.removeIf(u -> blockedIds.contains(u.getId()));

        return allUser;
    }


    @Override
    public List<User> getAllBlockUser(long id) {
        List<User> allUser=getAllUser();
        User user=findUserById(id);
        List<BlockedUser> blockedUsers=blockUserService.getBlockUser(user);
        List<User> users=new ArrayList<>();

        for (User u:allUser){
            for (BlockedUser blockedUser:blockedUsers){
                if(u.getId().equals(blockedUser.getBlocked().getId())){
                    users.add(u);
                }
            }
        }
        return users;
    }


    @Override
    @Transactional
    public boolean saveBlockUser(FriendRequest friendRequest) {
        if(friendRequest!=null){
            User blocker = findUserById(friendRequest.getSenderId());
            User blocked = findUserById(friendRequest.getReceivedId());
            if (blocker == null || blocked == null || blocker.getId().equals(blocked.getId())) {
                return false;
            }

            removeFriendshipAndPendingRequests(blocker, blocked);

            BlockedUser existing = blockUserService.getBlockUserByBlockerAndBlocked(friendRequest);
            if (existing != null) {
                return true;
            }

            BlockedUser blockedUser= BlockedUser.builder()
                    .blocker(blocker)
                    .blocked(blocked)
                    .build();
            blockUserService.blockUser(blockedUser);
            String blockerPhone = convertToInternationalFormat(blocker.getPhone());
            String blockedPhone = convertToInternationalFormat(blocked.getPhone());
            BlockEventPayload blockPayload = BlockEventPayload.builder()
                    .eventType("save-block")
                    .blockerId(friendRequest.getSenderId())
                    .blockedId(friendRequest.getReceivedId())
                    .timestamp(OffsetDateTime.now().toString())
                    .build();
            simpMessagingTemplate.convertAndSend("/topic/user/" + blockerPhone + "/save-block", blockPayload);
            simpMessagingTemplate.convertAndSend("/topic/user/" + blockedPhone + "/save-block", blockPayload);
            publishDirectBlockStatusChanged(blocker.getId(), blocked.getId(), true);
            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean cancelBlockUser(FriendRequest friendRequest) {
        if(friendRequest!=null){
            User blocker = findUserById(friendRequest.getSenderId());
            User blocked = findUserById(friendRequest.getReceivedId());
            BlockedUser blockedUser=blockUserService.getBlockUserByBlockerAndBlocked(friendRequest);
            if (blocker == null || blocked == null || blockedUser == null) {
                return false;
            }
            blockUserService.cancelBlockUser(blockedUser);
            String blockerPhone = convertToInternationalFormat(blocker.getPhone());
            String blockedPhone = convertToInternationalFormat(blocked.getPhone());
            BlockEventPayload cancelPayload = BlockEventPayload.builder()
                    .eventType("cancel-block")
                    .blockerId(friendRequest.getSenderId())
                    .blockedId(friendRequest.getReceivedId())
                    .timestamp(OffsetDateTime.now().toString())
                    .build();
            simpMessagingTemplate.convertAndSend("/topic/user/" + blockerPhone + "/cancel-block", cancelPayload);
            simpMessagingTemplate.convertAndSend("/topic/user/" + blockedPhone + "/cancel-block", cancelPayload);
            publishDirectBlockStatusChanged(blocker.getId(), blocked.getId(), false);
            return true;
        }
        return false;
    }

    private void publishDirectBlockStatusChanged(Long blockerId, Long blockedId, boolean blocked) {
        if (blockerId == null || blockedId == null) return;

        String directKey = directConversationService.buildDirectKey(blockerId, blockedId);
        Conversation conversation = conversationRepository.findByDirectKey(directKey)
                .orElseGet(() -> conversationRepository.findDirectConversationsByMemberIds(blockerId, blockedId)
                        .stream()
                        .findFirst()
                        .orElse(null));
        if (conversation == null) return;

        eventPublisher.publishEvent(new DirectBlockStatusChangedEvent(
                conversation.getId(),
                blockerId,
                blockedId,
                blocked,
                Set.of(blockerId, blockedId)
        ));
    }

    @Override
    public List<User> searchUserByUsername(String keyword) {
        User currentUser = getCurrentUser();
        List<User> users = userRepository.findUsersByUsernameContaining(keyword);
        if (currentUser == null) {
            return users;
        }

        Set<Long> hiddenUserIds = new HashSet<>();
        blockUserService.getBlockUser(currentUser).forEach(
                blocked -> hiddenUserIds.add(blocked.getBlocked().getId())
        );
        blockUserService.getBlockedByUser(currentUser).forEach(
                blocked -> hiddenUserIds.add(blocked.getBlocker().getId())
        );

        return users.stream()
                .filter(user -> !hiddenUserIds.contains(user.getId()))
                .collect(Collectors.toList());
    }

    private boolean removeFriendshipAndPendingRequests(User userA, User userB) {
        boolean changed = false;
        Friend friend = friendRepository.findFriendByUserAndFriend(userA, userB);
        if (friend == null) {
            friend = friendRepository.findFriendByUserAndFriend(userB, userA);
        }
        if (friend != null) {
            friendRepository.deleteById(friend.getId());
            changed = true;
        }

        Long userAId = userA.getId();
        Long userBId = userB.getId();
        changed = removeRedisFriendRequest(userAId, userBId) || changed;
        changed = removeRedisFriendRequest(userBId, userAId) || changed;
        return changed;
    }

    private boolean removeRedisFriendRequest(Long senderId, Long receiverId) {
        Long removedSent = redisTemplate.opsForSet().remove(buildSentRequestKey(senderId), String.valueOf(receiverId));
        Long removedReceived = redisTemplate.opsForSet().remove(buildReceivedRequestKey(receiverId), String.valueOf(senderId));
        Boolean deletedRequest = redisTemplate.delete(buildRequestKey(senderId, receiverId));
        return (removedSent != null && removedSent > 0)
                || (removedReceived != null && removedReceived > 0)
                || Boolean.TRUE.equals(deletedRequest);
    }

    private String buildSentRequestKey(long userId) {
        return "friend:sent:" + userId;
    }

    private String buildReceivedRequestKey(long userId) {
        return "friend:received:" + userId;
    }

    private String buildRequestKey(long senderId, long receiverId) {
        return "friend:request:" + senderId + ":" + receiverId;
    }


    private String convertToInternationalFormat(String phone) {
        if (phone == null || phone.isBlank()) {
            return phone;
        }
        if (phone.startsWith("+84")) {
            return phone;
        }
        if (phone.startsWith("0")) {
            return "+84" + phone.substring(1);
        }
        if (phone.startsWith("84")) {
            return "+" + phone;
        }
        return "+84" + phone;
    }

    private String randomUsernameGenerator(){
        String[] words1 = {"cool", "real", "baby", "mr", "miss", "its", "the", "not", "just"};
        String[] words2 = {"cat", "boy", "girl", "king", "queen", "vibe", "zone", "life", "mood"};
        Random random = new Random();

        String part1 = words1[random.nextInt(words1.length)];
        String part2 = words2[random.nextInt(words2.length)];

        int number = random.nextInt(999);

        String[] separators = {"", "_", "."};
        String sep = separators[random.nextInt(separators.length)];

        return part1 + sep + part2 + number;
    }

    // Hàm cập nhật lần hoạt động cuối cùng user
    @Transactional
    @Override
    public Instant updateLastActiveAt(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy User"));

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        user.setLastActiveAt(now);
        userRepository.save(user);

        return now;
    }

    @Override
    public PaginatedUserResponse searchMentionUsers(long viewerId, String keyword, int page, int size) {
        List<Long> friendIds = friendRepository.findAcceptedFriendIds(viewerId, FriendStatus.ACCEPTED.ordinal());

        if (friendIds == null || friendIds.isEmpty()) {
            return PaginatedUserResponse.builder()
                    .data(Collections.emptyList())
                    .page(page)
                    .hasMore(false)
                    .build();
        }

        Page<User> userPage = userRepository.findByIdInAndUsernameContainingIgnoreCase(
                friendIds,
                keyword,
                PageRequest.of(page, size)
        );

        return PaginatedUserResponse.builder()
                .data(userPage.getContent())
                .page(page)
                .hasMore(userPage.hasNext())
                .build();    }

    public boolean checkUserStatus(String phone) {
        try {
            AdminGetUserRequest request = AdminGetUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(phone)
                    .build();

            AdminGetUserResponse response = cognitoClient.adminGetUser(request);

            return "UNCONFIRMED".equals(response.userStatusAsString());

        } catch (UserNotFoundException e) {
            return false;
        }
    }

    @Override
    @Transactional
    public void logoutAllDevices(User user) {
        // Push WebSocket force-logout event BEFORE invalidating tokens
        // so connected web clients can gracefully logout in real-time.
        //
        // Broadcast the SAME payload on two topics:
        //   1. keyed by userId -> always present, independent of phone format.
        //      This is the reliable channel: it works even when the user has
        //      no phone or the international-format conversion differs slightly
        //      between server and client.
        //   2. keyed by phone  -> kept for backwards compatibility with any
        //      client still subscribing by phone.
        Map<String, Object> forceLogoutPayload = new HashMap<>();
        forceLogoutPayload.put("event", "FORCE_LOGOUT");
        forceLogoutPayload.put("userId", user.getId());
        forceLogoutPayload.put("timestamp", OffsetDateTime.now().toString());

        String byIdTopic = "/topic/user/" + user.getId() + "/force-logout";
        simpMessagingTemplate.convertAndSend(byIdTopic, forceLogoutPayload);
        System.out.println("🔴 Force logout WebSocket event sent to " + byIdTopic);

        if (user.getPhone() != null) {
            String userPhone = convertToInternationalFormat(user.getPhone());
            String byPhoneTopic = "/topic/user/" + userPhone + "/force-logout";
            simpMessagingTemplate.convertAndSend(byPhoneTopic, forceLogoutPayload);
            System.out.println("🔴 Force logout WebSocket event sent to " + byPhoneTopic);
        }

        List<ActiveToken> tokens = activeTokenRepository.findByUserId(user.getId());
        for (ActiveToken token : tokens) {
            BlackListUser bl = BlackListUser.builder()
                    .idToken(token.getIdToken())
                    .refreshToken(token.getRefreshToken())
                    .userId(user.getId())
                    .build();
            blackListUserRepository.save(bl);
        }
        activeTokenRepository.deleteByUserId(user.getId());
        deviceRepository.deleteDeviceByUser_Id(user.getId());
    }

    // Phân loại nền tảng từ deviceType client gửi lên: ANDROID/IOS/MOBILE -> MOBILE,
    // còn lại (WEB/UNKNOWN/null) -> WEB.
    private String resolvePlatform(String deviceType) {
        if (deviceType == null) return "WEB";
        String dt = deviceType.toUpperCase();
        if (dt.contains("ANDROID") || dt.contains("IOS") || dt.contains("MOBILE")) {
            return "MOBILE";
        }
        return "WEB";
    }

    // Đăng xuất các phiên CÙNG nền tảng của user (giữ nguyên phiên ở nền tảng khác).
    // Dùng khi đăng nhập để áp "1 phiên mỗi nền tảng": web đá web, mobile đá mobile.
    @Transactional
    public void logoutPlatformSessions(User user, String platform) {
        // Force-logout realtime tới đúng nền tảng đó qua topic riêng.
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", "FORCE_LOGOUT");
        payload.put("userId", user.getId());
        payload.put("platform", platform);
        payload.put("timestamp", OffsetDateTime.now().toString());
        String topic = "/topic/user/" + user.getId() + "/force-logout/" + platform;
        simpMessagingTemplate.convertAndSend(topic, payload);
        System.out.println("🔴 Platform force logout sent to " + topic);

        // Thu hồi (blacklist + xóa) các token cùng nền tảng.
        List<ActiveToken> tokens = activeTokenRepository.findByUserIdAndPlatform(user.getId(), platform);
        for (ActiveToken token : tokens) {
            blackListUserRepository.save(BlackListUser.builder()
                    .idToken(token.getIdToken())
                    .refreshToken(token.getRefreshToken())
                    .userId(user.getId())
                    .build());
        }
        activeTokenRepository.deleteByUserIdAndPlatform(user.getId(), platform);
    }

    @Override
    @Transactional
    public void requestAccountDeletion(User user) {
        user.setDeletionRequestedAt(OffsetDateTime.now());
        user.setDeletionScheduledFor(OffsetDateTime.now().plusDays(30));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void cancelAccountDeletion(User user) {
        user.setDeletionRequestedAt(null);
        user.setDeletionScheduledFor(null);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void setupPinCode(User user, String pinCode) {
        user.setPinCode(pinCode);
        userRepository.save(user);
    }

    @Override
    public boolean verifyPinCode(User user, String pinCode) {
        if (user.getPinCode() == null) {
            return false; // Chưa cài đặt mã PIN
        }
        return user.getPinCode().equals(pinCode);
    }

    @Override
    @Transactional
    public void removePinCode(User user) {
        user.setPinCode(null);
        userRepository.save(user);
    }
}
