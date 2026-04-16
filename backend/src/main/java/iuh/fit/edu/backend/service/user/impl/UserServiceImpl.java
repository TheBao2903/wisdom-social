/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.user.impl;

import iuh.fit.edu.backend.domain.entity.mysql.*;
import iuh.fit.edu.backend.dto.request.friend.FriendRequest;
import iuh.fit.edu.backend.dto.request.user.*;
import iuh.fit.edu.backend.dto.response.user.*;
import iuh.fit.edu.backend.config.filter.JwtAuthFilter;
import iuh.fit.edu.backend.mapper.UserMapper;
import iuh.fit.edu.backend.repository.mysql.BlackListUserRepository;
import iuh.fit.edu.backend.repository.mysql.DeviceRepository;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import iuh.fit.edu.backend.service.user.BlockUserService;
import iuh.fit.edu.backend.service.user.UserService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
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


    public UserServiceImpl(BlackListUserRepository blackListUserRepository,
                           BlockUserService blockUserService, CognitoIdentityProviderClient cognitoClient,
                           UserMapper userMapper, UserRepository userRepository,
                           SimpMessagingTemplate simpMessagingTemplate,
                           DeviceRepository deviceRepository) {
        this.blackListUserRepository = blackListUserRepository;
        this.blockUserService = blockUserService;
        this.cognitoClient = cognitoClient;
        this.userMapper = userMapper;
        this.userRepository = userRepository;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.deviceRepository = deviceRepository;
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
        String phone="+84"+confirm.getPhone().substring(1,10);

        System.out.println("Confirming registration for phone: " + phone + " with OTP: " + confirm.getOtp());
        ConfirmSignUpRequest request= ConfirmSignUpRequest.builder()
                .clientId(userClientId)
                .username(phone)
                .confirmationCode(confirm.getOtp())
                .build();

        ConfirmSignUpResponse response= cognitoClient.confirmSignUp(request);
        if(response!=null){

            return UserResponseConfirmRegister.builder()
                    .status(true)
                    .build();
        }
        return null;
    }

    @Override
    public UserResponseLogin loginUser(UserRequestLogin login) {
        String phone="+84"+login.getPhone().substring(1,10);
        Map<String,String> authParams=new HashMap<>();
        authParams.put("USERNAME",phone);
        authParams.put("PASSWORD",login.getPassword());

        InitiateAuthRequest request=InitiateAuthRequest.builder()
                .clientId(userClientId)
                .authFlow(AuthFlowType.USER_PASSWORD_AUTH)
                .authParameters(authParams)
                .build();

        InitiateAuthResponse response= cognitoClient.initiateAuth(request);
        AuthenticationResultType resultType=response.authenticationResult();

        if(resultType!=null){
            String accessToken  = resultType.accessToken();
            String refreshToken = resultType.refreshToken();
            String idToken=resultType.idToken();
            User user= userRepository.findByPhone(login.getPhone());
            saveDevice(user, login.getDeviceType(), login.getDeviceName(), login.getIpAddress());
            return UserResponseLogin.builder()
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
                    .build();
        }
        return null;
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

            return userRepository.findByPhone(phone);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public String getNewAccessToken(String refreshToken) {

        if (blackListUserRepository.existsByAnyToken(refreshToken)) {
            return "Refresh token revoked";
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
    public boolean resetPassword(UserRequestResetPassword requestResetPassword) {
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
            
            return response != null;
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
    public boolean saveBlockUser(FriendRequest friendRequest) {
        if(friendRequest!=null){
            User blocker = findUserById(friendRequest.getSenderId());
            User blocked = findUserById(friendRequest.getReceivedId());
            BlockedUser blockedUser= BlockedUser.builder()
                    .blocker(blocker)
                    .blocked(blocked)
                    .build();
            blockUserService.blockUser(blockedUser);
            String blockerPhone = convertToInternationalFormat(blocker.getPhone());
            String blockedPhone = convertToInternationalFormat(blocked.getPhone());
            simpMessagingTemplate.convertAndSend(
                    "/topic/user/" + blockerPhone + "/save-block",
                    "Người dùng này đã bị chặn"
            );
            simpMessagingTemplate.convertAndSend(
                    "/topic/user/" + blockedPhone + "/save-block",
                    "Bạn đã bị chặn"
            );
            return true;
        }
        return false;
    }

    @Override
    public boolean cancelBlockUser(FriendRequest friendRequest) {
        if(friendRequest!=null){
            User blocker = findUserById(friendRequest.getSenderId());
            User blocked = findUserById(friendRequest.getReceivedId());
            BlockedUser blockedUser=blockUserService.getBlockUserByBlockerAndBlocked(friendRequest);
            blockUserService.cancelBlockUser(blockedUser);
            String blockerPhone = convertToInternationalFormat(blocker.getPhone());
            String blockedPhone = convertToInternationalFormat(blocked.getPhone());
            simpMessagingTemplate.convertAndSend(
                    "/topic/user/" + blockerPhone + "/cancel-block",
                    "Người dùng này đã được gỡ chặn"
            );
            simpMessagingTemplate.convertAndSend(
                    "/topic/user/" + blockedPhone + "/cancel-block",
                    "Bạn đã được gỡ chặn"
            );
            return true;
        }
        return false;
    }

    @Override
    public List<User> searchUserByUsername(String keyword) {
        return userRepository.findUsersByUsernameContaining(keyword);
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
}
