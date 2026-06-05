package iuh.fit.edu.backend.modules.user.service;

import iuh.fit.edu.backend.modules.user.entity.Session;
import iuh.fit.edu.backend.modules.user.dto.request.UserRequestQRLogin;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseLogin;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseScanQRLogin;

public interface SessionService {
    String requestQrLogin();
    Session getSessionById(String sessionId);
    UserResponseScanQRLogin scanQRLogin(String session_id, long id);
    UserResponseLogin scanQRConfirmed(UserRequestQRLogin request);
    Session scanQRRejected(String session_id);
    UserResponseScanQRLogin getQRLoginStatus(String session_id);
}
