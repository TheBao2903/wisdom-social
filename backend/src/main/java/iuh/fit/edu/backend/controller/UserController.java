package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.friend.FriendRequest;
import iuh.fit.edu.backend.dto.request.user.*;
import iuh.fit.edu.backend.dto.response.user.*;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.service.user.BlockUserService;
import iuh.fit.edu.backend.service.user.UserService;
import iuh.fit.edu.backend.service.user.UserSettingService;
import iuh.fit.edu.backend.service.s3.S3Service;
import iuh.fit.edu.backend.util.anotation.ApiMessage;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class UserController {
    UserService userService;
    UserSettingService userSettingService;
    BlockUserService blockUserService;
    S3Service s3Service;


    public UserController(BlockUserService blockUserService, UserService userService,
                          UserSettingService userSettingService, S3Service s3Service) {
        this.blockUserService = blockUserService;
        this.userService = userService;
        this.userSettingService = userSettingService;
        this.s3Service = s3Service;
    }

    @PostMapping("/register")
    @ApiMessage("Register User success")
    public ResponseEntity<UserResponseRegister> registerUser(@RequestBody UserRequestRegister register,
                                                             HttpServletRequest httpRequest) {
        if (register.getIpAddress() == null || register.getIpAddress().isBlank()) {
            String ip = getClientIp(httpRequest);
            register.setIpAddress(ip);
        }
        UserResponseRegister responseRegister = userService.registerUser(register);
        return ResponseEntity.ok(responseRegister);
    }

    @PostMapping("/confirm")
    public ResponseEntity<UserResponseConfirmRegister> registerUser(@RequestBody UserRequestConfirmRegister confirm){
        UserResponseConfirmRegister responseConfirmRegister=userService.confirmRegisterUser(confirm);
        return ResponseEntity.ok(responseConfirmRegister);
    }

    @PostMapping("/login")
    @ApiMessage("Login User success")
    public ResponseEntity<UserResponseLogin> loginUser(@RequestBody UserRequestLogin login,
                                                       HttpServletRequest httpRequest) {
        if (login.getIpAddress() == null || login.getIpAddress().isBlank()) {
            String ip = getClientIp(httpRequest);
            login.setIpAddress(ip);
        }
        UserResponseLogin responseLogin = userService.loginUser(login);
        return ResponseEntity.ok(responseLogin);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logoutUser(HttpServletRequest request){
        String idToken = null;
        String refreshToken = null;
        String refreshTokenQr = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName())) {
                    idToken = cookie.getValue();
                }
                if ("refreshToken".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                }
                if ("refreshTokenQr".equals(cookie.getName())) {
                    refreshTokenQr = cookie.getValue();
                }
            }
        }
        if (refreshToken == null) {
            refreshToken = refreshTokenQr;
        }
        userService.logoutUser(idToken,refreshToken);
        return ResponseEntity.ok("Logout success");
    }

    @GetMapping("/refresh")
    public ResponseEntity<String> getNewAccessToken(HttpServletRequest request){
        String refreshToken=null;
        if(request.getCookies()!=null){
            for (Cookie cookie:request.getCookies()){
                if("refreshToken".equals(cookie.getName())){
                    refreshToken=cookie.getValue();
                }
            }
        }

        String accessToken=userService.getNewAccessToken(refreshToken);
        return ResponseEntity.ok(accessToken);
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<User>> me() {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(401, "Unauthorized - No authenticated user found", null));
        }
        return ResponseEntity.ok(ApiResponse.success(200, "Get current user successfully", currentUser));
    }

    @PostMapping("/forgot-password")
    @ApiMessage("OTP sent successfully")
    public ResponseEntity<UserResponseOTPPassword> forgotPassword(@RequestBody UserRequestForgotPassword requestForgotPassword) {
        UserResponseOTPPassword response = userService.forgotPasswordUser(requestForgotPassword);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    @ApiMessage("Password reset successfully")
    public ResponseEntity<String> resetPassword(@RequestBody UserRequestResetPassword requestResetPassword) {
        boolean success = userService.resetPassword(requestResetPassword);
        if (success) {
            return ResponseEntity.ok("Password has been reset successfully");
        }
        return ResponseEntity.badRequest().body("Failed to reset password");
    }

    @GetMapping("/users")
    @ApiMessage("Get all User")
    public ResponseEntity<List<User>> getAllUser(){
        return ResponseEntity.ok(userService.getAllUser());
    }

    @DeleteMapping("/users/{id}")
    @ApiMessage("Delete User successfully")
    public ResponseEntity<String> deleteUser(@PathVariable long id){
        boolean success=userService.deleteUser(id);
        if (success) {
            return ResponseEntity.ok("Delete User successfully");
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("User not found");
    }

    @PutMapping("/users/{id}")
    @ApiMessage("Update User successfully")
    public ResponseEntity<User> updateUser(@PathVariable long id, @RequestBody UserRequestUpdate update){
        try {
            boolean success = userService.updateUser(id, update);
            if (success) {
                // Always fetch and return the updated user
                User updatedUser = userService.findUserById(id);
                return ResponseEntity.ok(updatedUser);
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/user/{id}")
    @ApiMessage("Get profile User")
    public ResponseEntity<UserProfileResponse> getProfileUser(@PathVariable long id){
        return ResponseEntity.ok(userSettingService.getProfileUser(id));
    }

    @GetMapping("/users/{id}")
    @ApiMessage("Get all User")
    public ResponseEntity<List<User>> getAllForUser(@PathVariable long id){
        return ResponseEntity.ok(userService.getAllForUser(id));
    }

    @GetMapping("/users/username/{keyword}")
    @ApiMessage("Get all User by keyword")
    public ResponseEntity<List<User>> getAllByUsername(@PathVariable String keyword){
        return ResponseEntity.ok(userService.searchUserByUsername(keyword));
    }

    @GetMapping("/users/blocked/{id}")
    @ApiMessage("Get all User")
    public ResponseEntity<List<User>> getBlockUser(@PathVariable long id){
        return ResponseEntity.ok(userService.getAllBlockUser(id));
    }

    @PostMapping("/users/block")
    @ApiMessage("Block User successfully")
    public ResponseEntity<String> blockUser(@RequestBody FriendRequest friendRequest){
        boolean success=userService.saveBlockUser(friendRequest);
        if(success){
            return ResponseEntity.ok("Block User successfully");
        }
        return ResponseEntity.badRequest().body("Block User failed");
    }

    @PostMapping("/users/cancel-block")
    @ApiMessage("Cancel block User successfully")
    public ResponseEntity<String> cancelBlockUser(@RequestBody FriendRequest friendRequest){
        boolean success=userService.cancelBlockUser(friendRequest);
        if(success){
            return ResponseEntity.ok("Cancel block User successfully");
        }
        return ResponseEntity.badRequest().body("Cancel block User failed");
    }

    @GetMapping("/users/update/upload-avatar")
    @ApiMessage("Upload image successfully")
    public ResponseEntity<String> updateUploadImage(@RequestParam String type,
                                           @RequestParam String extension){
        User user=userService.getCurrentUser();
        Map<String,String> image= s3Service.generateUpdateUploadUrl(type,user.getId(),extension);

        UserRequestUpdate update=new UserRequestUpdate();
        update.setAvatarUrl(image.get("imageUrl"));
        userService.updateUser(user.getId(), update);

        return ResponseEntity.ok(image.get("uploadUrl"));
    }

    @GetMapping("/upload-avatar")
    @ApiMessage("Upload image successfully")
    public ResponseEntity<Map<String,String>> uploadImage(@RequestParam String type,
                                                          @RequestParam String extension){
        return ResponseEntity.ok(s3Service.generateUploadUrl(type,extension));
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

//    @PostMapping("/status/bulk")
//    public ResponseEntity<ApiResponse<List<UserStatusResponse>>> getBulkUserStatus(
//            @RequestBody List<Long> userIds) {
//
//        // 1. Lấy thông tin từ DB (Nên có hàm findUsersByIds trong UserService)
//        List<User> users = userService.findUsersByIds(userIds);
//
//        // 2. Map dữ liệu kết hợp với Cache
//        List<UserStatusResponse> statuses = users.stream().map(user -> {
//            boolean isOnline = userCacheService.isUserOnline(user.getId());
//            return UserStatusResponse.builder()
//                    .userId(user.getId())
//                    .isOnline(isOnline)
//                    .lastSeen(isOnline ? null : user.getLastActiveAt())
//                    .build();
//        }).toList();
//
//        return ResponseEntity.ok(new ApiResponse<>(200, "Thành công", statuses));
//    }
}
