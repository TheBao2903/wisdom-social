package iuh.fit.edu.backend.modules.notification.constant;

public enum NotificationType {
    // Reaction notifications
    REACTION_POST,
    REACTION_COMMENT,
    REACTION_STORY,
    REACTION_NOTE,

    // Comment notifications
    COMMENT_POST,
    COMMENT_MENTION,
    REPLY_COMMENT,

    // Share notifications
    SHARE_POST,

    // Friend notifications
    FRIEND_REQUEST,
    FRIEND_ACCEPT,

    // Tag notifications
    TAG_POST,
    TAG_COMMENT,
    TAG_STORY,

    // Story notifications
    STORY_MENTION,
    STORY_REPLY,

    // Group notifications
    GROUP_INVITE,
    GROUP_POST,
    GROUP_MENTION,

    // Page notifications - for admins/moderators
    PAGE_JOIN_REQUEST,   // a user requests to join the page
    PAGE_POST_SUBMITTED, // a member submits a post waiting for approval
    PAGE_LIKE,           // a user likes the page
    PAGE_FOLLOW,         // a user follows the page

    // Page notifications - for members/users
    PAGE_JOIN_APPROVED,  // join request approved
    PAGE_POST_APPROVED,  // submitted post approved
    PAGE_MEMBER_ADDED,   // an admin added the user to the page

    // Report notifications - for the reporter
    REPORT_REVIEWED,     // admin đã xem xét/xử lý báo cáo của người dùng

    // System notifications
    SYSTEM_ANNOUNCEMENT,
    BIRTHDAY_REMINDER,
    MEMORY_REMINDER
}