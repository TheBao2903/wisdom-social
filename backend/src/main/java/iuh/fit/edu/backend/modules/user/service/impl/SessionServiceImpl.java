package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.modules.user.constant.SessionStatus;
import iuh.fit.edu.backend.modules.user.entity.Session;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.UserRequestQRLogin;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseLogin;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseScanQRLogin;
import iuh.fit.edu.backend.modules.user.repository.SessionRepository;
import iuh.fit.edu.backend.modules.user.service.SessionService;
import iuh.fit.edu.backend.modules.user.service.UserService;
import org.springframework.stereotype.Service;
import java.time.OffsetDateTime;

@Service
public class SessionServiceImpl implements SessionService {
    SessionRepository sessionRepository;
    UserService userService;

    public SessionServiceImpl(SessionRepository sessionRepository,
                              UserService userService) {
        this.sessionRepository = sessionRepository;
        this.userService = userService;
    }

    @Override
    public String requestQrLogin() {
        Session session=new Session();
        session.setStatus(SessionStatus.PENDING);
        session.setUser(null);
        session.setExpireAt(OffsetDateTime.now().plusMinutes(1));
        sessionRepository.save(session);

        return session.getSeesion_id();
    }

    @Override
    public Session getSessionById(String sessionId) {
        return sessionRepository.findById(sessionId).orElse(null);
    }

    @Override
    public UserResponseScanQRLogin scanQRLogin(String session_id, long id) {
        User user=userService.findUserById(id);
        Session session=sessionRepository.findById(session_id).orElse(null);
            if (session!=null && user!=null &&session.getStatus().equals(SessionStatus.PENDING)){
                session.setUser(user);
                session.setExpireAt(OffsetDateTime.now().plusMinutes(1));
                session.setStatus(SessionStatus.SCANNED);
                sessionRepository.save(session);

                UserResponseScanQRLogin response=new UserResponseScanQRLogin();
                response.setSeesion_id(session_id);
                response.setUser(user);
                response.setExpireAt(OffsetDateTime.now().plusMinutes(1));
                response.setStatus(SessionStatus.SCANNED);
                return response;
            }
        return null;
    }

    @Override
    public UserResponseLogin scanQRConfirmed(UserRequestQRLogin request) {
        Session session=sessionRepository.findById(request.getSession_id()).orElse(null);
        if (session!=null && session.getStatus().equals(SessionStatus.SCANNED)){
            session.setExpireAt(OffsetDateTime.now());
            session.setStatus(SessionStatus.CONFIRMED);
            sessionRepository.save(session);

            userService.saveDevice(session.getUser(),request.getDeviceType(), request.getDeviceName(), request.getIpAddress());

            return UserResponseLogin.builder()
                    .idToken(null)
                    .phone(session.getUser().getPhone())
                    .gender(session.getUser().getGender())
                    .username(session.getUser().getUsername())
                    .birthday(session.getUser().getBirthday())
                    .build();
        }
        return null;
    }

    @Override
    public Session scanQRRejected(String session_id) {
        Session session=sessionRepository.findById(session_id).orElse(null);
        if (session!=null && session.getStatus().equals(SessionStatus.SCANNED)){
            session.setExpireAt(OffsetDateTime.now());
            session.setStatus(SessionStatus.REJECTED);
            sessionRepository.save(session);
            return session;
        }
        return null;
    }

    @Override
    public UserResponseScanQRLogin getQRLoginStatus(String session_id) {
        Session session = sessionRepository.findById(session_id).orElse(null);
        if (session != null) {
            UserResponseScanQRLogin response = new UserResponseScanQRLogin();
            response.setSeesion_id(session_id);
            response.setStatus(session.getStatus());
            response.setUser(session.getUser());
            response.setExpireAt(session.getExpireAt());
            return response;
        }
        return null;
    }


}
