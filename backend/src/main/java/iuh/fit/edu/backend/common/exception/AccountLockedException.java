package iuh.fit.edu.backend.common.exception;

import lombok.Getter;

@Getter
public class AccountLockedException extends RuntimeException {
    private final long remainingSeconds;
    private final String lockReason;

    public AccountLockedException(long remainingSeconds, String lockReason) {
        super("Tài khoản đã bị khóa: " + lockReason);
        this.remainingSeconds = remainingSeconds;
        this.lockReason = lockReason;
    }
}
