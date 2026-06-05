/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.service;

import iuh.fit.edu.backend.modules.chat.constant.MessageType;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
public interface InternalMessageService {
    void createSystemMessage(Long conversationId, Long actorId, MessageType type, String content);
}
