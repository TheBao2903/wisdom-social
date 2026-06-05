package iuh.fit.edu.backend.modules.conversation.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import iuh.fit.edu.backend.modules.conversation.dto.response.JoinRequestResponse;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Set;

@Getter
public class NewJoinRequestEvent {
    private final Long conversationId;
    private final JoinRequestResponse requestData; // Dữ liệu của người xin vào
    @JsonIgnore
    private final Set<Long> notifyAdminIds; // Tập hợp ID của các Admin cần nhận thông báo
    private final DomainEventType domainEventType;

    @JsonCreator
    public NewJoinRequestEvent(@JsonProperty("conversationId") Long conversationId,
                               @JsonProperty("requestData") JoinRequestResponse requestData,
                               @JsonProperty("notifyAdminIds") Set<Long> notifyAdminIds) {
        this.conversationId = conversationId;
        this.requestData = requestData;
        this.notifyAdminIds = notifyAdminIds;
        this.domainEventType = DomainEventType.NEW_JOIN_REQUEST;
    }
}