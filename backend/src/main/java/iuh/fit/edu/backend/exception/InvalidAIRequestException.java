package iuh.fit.edu.backend.exception;

public class InvalidAIRequestException extends RuntimeException {
    public InvalidAIRequestException(String message) {
        super(message);
    }
}
