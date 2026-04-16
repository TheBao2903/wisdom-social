package iuh.fit.edu.backend.event.handler;

import java.util.Set;

public interface RedisEventHandler {
    Class<?> getSupportedClass();
    String getSupportedEventType();
    void handle(Object eventPayload, Set<Long> targetMemberIds);
}