/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.chat.constant;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
public enum MessageType {
    TEXT,
    FILE,
    VIDEO,
    IMAGE,
    LINK,
    STICKER,
    AUDIO,
    CALL,
    POLL,
    SYSTEM_PIN,
    SYSTEM_UPIN,
    SYSTEM_POLL_CREATED,
    SYSTEM_POLL_VOTED,
    SYSTEM_POLL_CHANGED,
    SYSTEM_POLL_CLOSED,
    SYSTEM_POLL_PINNED,
    SYSTEM_CREATE_GROUP,
    SYSTEM_ADD_MEMBER,
    SYSTEM_LEAVE_GROUP,
    SYSTEM_KICK_MEMBER,
    SYSTEM_BLOCK_MEMBER,
    SYSTEM_UPDATE_ROLE,
    SYSTEM_DISBAND_GROUP,
    SYSTEM_UPDATE_SETTING,
    SYSTEM_REQUIRE_APPROVAL,
    SYSTEM_JOIN_VIA_LINK,
    SYSTEM_MEMBER_BLOCKED_FROM_JOIN,
    SYSTEM_GROUP_INVITE_LINK_SENT,
}
