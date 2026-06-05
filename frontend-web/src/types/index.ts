import type { NoteMusic } from "./note";

// API Response Types
export interface ApiResponse<T> {
    status: number;
    success: boolean;
    message: string;
    data: T | null;
    errors?: any;
    timestamp: string; // OffsetDateTime -> ISO string
}

// User Types
export interface User {
    id: number;
    username: string;
    fullName: string;
    avatarUrl: string;
    bio?: string;
    phone?: string;
    gender?: "MALE" | "FEMALE" | "OTHER";
    name?: string;
    birthday?: string;
    isVerified?: boolean;
    friendsCount?: number;
    followersCount?: number;
    followingCount?: number;
    postsCount?: number;
    // Account deletion (15-day pending wipe)
    deletionRequestedAt?: string | null;
    deletionScheduledFor?: string | null;
    hasPinCode?: boolean;
    isPrivate?: boolean;
    privacyProfile?: "PUBLIC" | "FRIENDS" | "ONLY_ME";
}

// Post Types
export type PrivacyType = "PUBLIC" | "FRIENDS" | "ONLY_ME" | "SPECIFIC" | "EXCEPT";

export interface Post {
    id: string;
    user: User;
    images: string[];
    media?: Array<{ url: string; type: string; duration?: number; width?: number; height?: number }>;
    caption: string;
    likes: number;
    comments: Comment[];
    createdAt: string;
    lastActivityAt?: string;
    rankingTime?: string;
    isLiked?: boolean;
    isSaved?: boolean;
    privacy?: PrivacyType;
    allowComments?: boolean;
    allowShares?: boolean;
    music?: NoteMusic;
    location?:
    | string
    | {
        name?: string;
        address?: string;
    };
}

export interface Comment {
    id: string;
    user: User;
    text: string;
    createdAt: string;
    likes: number;
}

// Story Types
export interface TextLayerStyle {
    fontSize: number;
    fontFamily: string;
    color: string;
    align: "left" | "center" | "right";
    rotation?: number;
    bold?: boolean;
    shadow?: boolean;
}

export interface TextLayer {
    id: string;
    content: string;
    x_pct: number;
    y_pct: number;
    width_pct?: number;
    height_pct?: number;
    style: TextLayerStyle;
    z_index: number;
}

export type MusicStickerStyle = "compact" | "rectangle" | "square" | "vinyl" | "hidden";

export const MUSIC_STICKER_STYLES: Record<MusicStickerStyle, MusicStickerStyle> = {
    compact: "compact",
    rectangle: "rectangle",
    square: "square",
    vinyl: "vinyl",
    hidden: "hidden",
};

export interface MusicStickerMetadata {
    track_id: string;
    title: string;
    artist: string;
    cover_url?: string;
    start_sec?: number;
    end_sec?: number;
}

export interface MusicSticker {
    id: string;
    x_pct: number;
    y_pct: number;
    width_pct?: number;
    height_pct?: number;
    rotation_deg?: number;
    style?: MusicStickerStyle;
    meta: MusicStickerMetadata;
    z_index: number;
}

export interface Story {
    id: string;
    user: User;
    image: string;
    createdAt: string;
    isViewed?: boolean;
    text?: string;
    media?: { url: string; type: string; duration_ms?: number };
    music?: { title?: string; artist?: string; muteOriginal?: boolean };
    text_layers?: TextLayer[];
    music_stickers?: MusicSticker[];
    duration_ms?: number;
    privacy?: string;
    allowReplies?: boolean;
    allowReactions?: boolean;
    allowSharing?: boolean;
}

// Message Types
export interface Message {
    id: string;
    senderId: string;
    text: string;
    createdAt: string;
    isRead?: boolean;
}

export interface Chat {
    id: string;
    user: User;
    lastMessage: Message;
    unreadCount: number;
}

// Notification Types
export type NotificationType =
    | 'REACTION_POST' | 'REACTION_COMMENT' | 'REACTION_STORY' | 'REACTION_NOTE'
    | 'COMMENT_POST' | 'COMMENT_MENTION' | 'REPLY_COMMENT'
    | 'SHARE_POST'
    | 'FRIEND_REQUEST' | 'FRIEND_ACCEPT'
    | 'TAG_POST' | 'TAG_COMMENT' | 'TAG_STORY'
    | 'STORY_MENTION' | 'STORY_REPLY'
    | 'GROUP_INVITE' | 'GROUP_POST' | 'GROUP_MENTION'
    | 'PAGE_JOIN_REQUEST' | 'PAGE_POST_SUBMITTED' | 'PAGE_LIKE' | 'PAGE_FOLLOW'
    | 'PAGE_JOIN_APPROVED' | 'PAGE_POST_APPROVED' | 'PAGE_MEMBER_ADDED'
    | 'SYSTEM_ANNOUNCEMENT' | 'BIRTHDAY_REMINDER' | 'MEMORY_REMINDER';

export type TargetType = 'POST' | 'POST_SHARE' | 'NOTE' | 'STORY' | 'COMMENT' | 'PAGE' | 'USER';

export interface NotificationMetadata {
    imageUrl?: string;
    actorName?: string;
    count?: number;
    deepLink?: string;
    extraData?: string;
}

export interface Notification {
    id: string;
    recipientId: string;
    actorIds: string[];
    type: NotificationType;
    targetType?: TargetType;
    targetId?: string;
    content?: string;
    metadata?: NotificationMetadata;
    isRead: boolean;
    readAt?: string;
    createdAt: string;
}