/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.payload;

import com.fasterxml.jackson.annotation.JsonProperty;
import iuh.fit.edu.backend.dto.response.user.UserStatusResponse;
import iuh.fit.edu.backend.event.type.DomainEventType;
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
    private final DomainEventType type = DomainEventType.USER_STATUS;

    public UserStatusEvent(UserStatusResponse payload) {
        this.payload = payload;
    }
}
