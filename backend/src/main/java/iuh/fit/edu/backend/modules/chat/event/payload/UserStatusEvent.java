/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.event.payload;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.modules.user.dto.response.UserStatusResponse;
import iuh.fit.edu.backend.common.event.type.DomainEventType;
import lombok.Getter;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Getter
public class UserStatusEvent {

    private final UserStatusResponse payload;
    private final DomainEventType domainEventType = DomainEventType.USER_STATUS;

    @JsonCreator
    public UserStatusEvent(@JsonProperty("payload") UserStatusResponse payload) {
        this.payload = payload;
    }
}
