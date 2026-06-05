package iuh.fit.edu.backend.common.exception;

public class ConversationMemberLeftException extends RuntimeException {
    public ConversationMemberLeftException(String message) {
        super(message);
    }
}