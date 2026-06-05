package iuh.fit.edu.backend.common.exception;

import lombok.Getter;

@Getter
public class RateLimitExceededException extends RuntimeException {
    private final long remainingSeconds;

    public RateLimitExceededException(long remainingSeconds) {
        super("Quá nhiều lần thử. Vui lòng thử lại sau " + Math.ceil(remainingSeconds / 60.0) + " phút.");
        this.remainingSeconds = remainingSeconds;
    }
}
