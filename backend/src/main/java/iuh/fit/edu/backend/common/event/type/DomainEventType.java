/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.event.type;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
public enum DomainEventType {
    // Message
    MESSAGE_CREATED,
    MESSAGE_RECALLED,
    MESSAGE_SEEN,
    MESSAGE_REACTION,
    POLL_UPDATED,
    TYPING,
    PIN_MESSAGE,
    UPIN_MESSAGE,
    USER_STATUS,


    // Conversation
    ROOM_CREATED,
    ROOM_UPDATED,
    ROOM_DELETED,

    // Group membership
    MEMBER_ADDED,
    MEMBER_ROLE_UPDATED,
    MEMBER_UPDATED,
    MEMBER_ACCOUNT_LOCK_CHANGED,
    DIRECT_BLOCK_STATUS_CHANGED,
    MEMBER_LEFT,
    MEMBER_KICKED,
    CONVERSATION_BLOCKED_MEMBERS_UPDATED,
    GROUP_DISBANDED,
    NEW_JOIN_REQUEST,
    JOIN_REQUEST_PROCESSED,

    // Page membership
    PAGE_MEMBER_JOINED,
    PAGE_MEMBER_LEFT,
    PAGE_MEMBER_BLOCKED,
    PAGE_MEMBER_UNBLOCKED,
    PAGE_MEMBER_ROLE_CHANGED,
    PAGE_JOIN_REQUESTED,
    PAGE_JOIN_APPROVED,
    PAGE_JOIN_REJECTED,
    PAGE_JOIN_CANCELLED,

    // Page post events
    PAGE_POST_SUBMITTED,
    PAGE_POST_APPROVED,
    PAGE_POST_REJECTED,
    PAGE_POST_REMOVED,

    // Page list events
    PAGE_CREATED,
    PAGE_UPDATED,
    PAGE_DELETED,

    // Post, Comment, Reaction, Notification
    POST,
    COMMENT,
    REACTION,
    NOTIFICATION
}

