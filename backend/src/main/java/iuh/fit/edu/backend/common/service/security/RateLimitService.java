package iuh.fit.edu.backend.common.service.security;

public interface RateLimitService {
    long checkLoginLock(String phone, String ip);
    long recordFailedLogin(String phone, String ip);
    void clearLoginAttempts(String phone, String ip);
    long checkOtpLock(String phone);
    long recordFailedOtp(String phone);
    void clearOtpAttempts(String phone);
}
