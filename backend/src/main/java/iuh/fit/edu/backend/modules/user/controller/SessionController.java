package iuh.fit.edu.backend.modules.user.controller;

import iuh.fit.edu.backend.common.config.JwtAuthFilter;
import iuh.fit.edu.backend.modules.user.constant.SessionStatus;
import iuh.fit.edu.backend.modules.user.entity.Session;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.UserRequestQRLogin;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseLogin;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseQRLoginToken;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseScanQRLogin;
import iuh.fit.edu.backend.modules.user.service.SessionService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import iuh.fit.edu.backend.common.util.anotation.ApiMessage;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/session")
public class SessionController {
    SessionService service;
    UserService userService;

    public SessionController(SessionService service, UserService userService) {
        this.service = service;
        this.userService = userService;
    }

    @GetMapping("/qr-login/create")
    @ApiMessage("create QR image successfully")
    public ResponseEntity<String> createQRLogin(){
        return ResponseEntity.ok(service.requestQrLogin());
    }

    @GetMapping("/qr-login/scan")
    @ApiMessage("Scan QR image successfully")
    public ResponseEntity<UserResponseScanQRLogin> scanQRLogin(@RequestParam String session_id){
        User user=userService.getCurrentUser();
        return ResponseEntity.ok(service.scanQRLogin(session_id,user.getId()));
    }

    @PostMapping("/qr-login/confirm")
    @ApiMessage("Confirm QR login successfully")
    public ResponseEntity<UserResponseLogin> cofirmQRLogin(@RequestBody UserRequestQRLogin requestQRLogin, HttpServletRequest request){
        String ip = getClientIp(request);
        requestQRLogin.setIpAddress(ip);
        return ResponseEntity.ok(service.scanQRConfirmed(requestQRLogin));
    }

    @GetMapping("/qr-login/reject")
    @ApiMessage("Scan QR image successfully")
    public ResponseEntity<Session> rejectQRLogin(@RequestParam String session_id){
        return ResponseEntity.ok(service.scanQRRejected(session_id));
    }

    @GetMapping("/qr-login/status/{session_id}")
    @ApiMessage("Get QR login status")
    public ResponseEntity<UserResponseScanQRLogin> getQRLoginStatus(@PathVariable String session_id){
        return ResponseEntity.ok(service.getQRLoginStatus(session_id));
    }

    @GetMapping("/qr-login/access-token/{session_id}")
    @ApiMessage("Get QR login token")
    public ResponseEntity<UserResponseQRLoginToken> getAccessToken(@PathVariable String session_id){
        Session session=service.getSessionById(session_id);
        if (session.getStatus().equals(SessionStatus.CONFIRMED)){
            String accessToken = JwtAuthFilter.generateToken(session.getUser().getPhone());
            String refreshToken = JwtAuthFilter.generateRefreshToken(session.getUser().getPhone());
            return ResponseEntity.ok(
                UserResponseQRLoginToken.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .build()
            );
        }
        return ResponseEntity.badRequest().body(null);
    }

    @GetMapping("/qr-login/access-token")
    @ApiMessage("Refresh QR access token")
    public ResponseEntity<String> refreshQrAccessToken(HttpServletRequest request) {
        String refreshToken = null;

        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if ("refreshTokenQr".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(null);
        }

        try {
            return ResponseEntity.ok(userService.getNewQrAccessToken(refreshToken));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(null);
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

}
