package iuh.fit.edu.backend.common.exception;

public class ExternalAIServiceException extends RuntimeException {
    public ExternalAIServiceException(String message) {
        super(message);
    }

    public ExternalAIServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
