package iuh.fit.edu.backend.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.event.type.DomainEventType;
import lombok.Getter;

import java.util.Set;

@Getter
public class RedisEnvelope {
    // Dữ liệu Định tuyến (Để Server biết gửi cho ai)
    private final Set<Long> targetMemberIds;

    private final DomainEventType domainEventType;
    
    // Nội dung lõi (Các Event thuần túy)
    private final Object payload;

    // Đây là class DUY NHẤT cần các Annotation lằng nhằng của Jackson
    @JsonCreator
    public RedisEnvelope(
            @JsonProperty("targetMemberIds") Set<Long> targetMemberIds,
            @JsonProperty("domainEventType") DomainEventType domainEventType,
            @JsonProperty("payload") Object payload) {
        this.targetMemberIds = targetMemberIds;
        this.domainEventType = domainEventType;
        this.payload = payload;
    }
}