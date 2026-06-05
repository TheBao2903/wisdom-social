export type User = {
    id: string;
    username: string;
    fullName: string;
    name?: string;
    bio: string;
    avatarUrl?: string;
    avatar?: string;
    phone?: string;
    followers: number;
    following: number;
    friendsCount?: number;
    followersCount?: number;
    followingCount?: number;
    postsCount?: number;
    website?: string;
    birthday?: string;
    gender?: "MALE" | "FEMALE" | "HIDDEN";
    hasPinCode?: boolean;
};

export type StoryMedia = {
    url: string;
    type: string;
    thumbnailUrl?: string;
    duration_ms?: number;
};

export type TextLayerStyle = {
    fontSize: number;
    fontFamily: string;
    color: string;
    align: "left" | "center" | "right";
    rotation?: number;
    bold?: boolean;
    shadow?: boolean;
};

export type TextLayer = {
    id: string;
    content: string;
    x_pct: number;
    y_pct: number;
    width_pct?: number;
    height_pct?: number;
    style: TextLayerStyle;
    z_index: number;
};

export type MusicStickerStyle = "compact" | "rectangle" | "square" | "vinyl" | "hidden";

export const MUSIC_STICKER_STYLES: Record<MusicStickerStyle, MusicStickerStyle> = {
    compact: "compact",
    rectangle: "rectangle",
    square: "square",
    vinyl: "vinyl",
    hidden: "hidden",
};

export type MusicStickerMetadata = {
    track_id: string;
    title: string;
    artist: string;
    cover_url?: string;
    audio_url?: string;
    start_sec?: number;
    end_sec?: number;
};

export type MusicSticker = {
    id: string;
    x_pct: number;
    y_pct: number;
    width_pct?: number;
    height_pct?: number;
    rotation_deg?: number;
    style?: MusicStickerStyle;
    meta: MusicStickerMetadata;
    z_index: number;
};

export type StoryMusic = {
    id?: string;
    trackId?: string | number;
    title?: string;
    artist?: string;
    audioUrl?: string;
    thumbnail?: string;
    coverUrl?: string;
    muteOriginal?: boolean;
};

export type Story = {
    id: string;
    userId: string;
    image: string;
    viewed: boolean;
    isViewed?: boolean;
    createdAt: string;
    text?: string;
    content?: string;
    media?: StoryMedia;
    user?: User;
    music?: StoryMusic;
    textStyle?: unknown;
    text_layers?: TextLayer[];
    music_stickers?: MusicSticker[];
    duration_ms?: number;
    privacy?: PrivacyType;
    allowReplies?: boolean;
    allowReactions?: boolean;
    allowSharing?: boolean;
    viewCount?: number;
};

export type StoryGroup = {
    userId: string;
    username: string;
    userAvatar: string;
    stories: Story[];
    highlightId?: string;
};

export type StoryViewerInfo = {
    viewerId: string;
    viewedAt: string;
    reaction?: string;
    username?: string;
    avatarUrl?: string;
};

export type PrivacyType = "PUBLIC" | "FRIENDS" | "ONLY_ME" | "SPECIFIC" | "EXCEPT";

export type PostMedia = {
    url: string;
    type: string;
    order?: number;
    duration?: number;
    width?: number;
    height?: number;
};

export type PostMusic = {
    trackId?: string | number;
    title?: string;
    artist?: string;
    coverUrl?: string;
    thumbnail?: string;
    audioUrl?: string;
    duration?: number;
    muteOriginal?: boolean;
    originalVolume?: number;
    musicVolume?: number;
};

export type Comment = {
    id: string;
    userId?: string;
    user?: User;
    content?: string;
    text?: string;
    createdAt: string;
    likes?: number;
    parentId?: string | null;
};

export type Post = {
    id: string;
    userId: string;
    user?: User;
    image: string;
    images?: string[];
    media?: PostMedia[];
    caption: string;
    likes: number;
    comments: Comment[];
    commentsCount?: number;
    shares?: number;
    createdAt: string;
    lastActivityAt?: string;
    rankingTime?: string;
    isLiked?: boolean;
    isSaved?: boolean;
    privacy?: PrivacyType;
    allowComments?: boolean;
    allowShares?: boolean;
    taggedUserIds?: string[];
    music?: PostMusic;
    authorSummary?: User;
    location?:
    | string
    | {
        name?: string;
        address?: string;
    };
};

export interface ApiResponse<T> {
    status: number;
    success: boolean;
    message: string;
    data: T | null;
    errors?: unknown;
    timestamp: string;
}

export type NotificationType =
    | "REACTION_POST" | "REACTION_COMMENT" | "REACTION_STORY" | "REACTION_NOTE"
    | "COMMENT_POST" | "COMMENT_MENTION" | "REPLY_COMMENT"
    | "SHARE_POST"
    | "TAG_POST" | "TAG_COMMENT" | "STORY_REPLY";

export type TargetType = "POST" | "POST_SHARE" | "NOTE" | "STORY" | "COMMENT";

export interface NotificationMetadata {
    imageUrl?: string;
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

export type AppNotification = Omit<Notification, "type"> & {
    type: NotificationType | "like" | "comment" | "mention";
    userId?: string;
    postId?: string;
    message?: string;
    read?: boolean;
};

export type Message = {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
};

export type Conversation = {
    id: string;
    participantIds: string[];
    lastMessage: string;
    updatedAt: string;
};

export type IgtvVideo = {
    id: string;
    title: string;
    thumbnail: string;
    duration: string;
    views: number;
    userId: string;
    description: string;
};

export type ProfileStats = {
    posts: number;
    followers: number;
    following: number;
};

export type AuthResult = {
    success: boolean;
    message?: string;
    remainingSeconds?: number;
    lockReason?: string;
    deletionPending?: boolean;
    deletionRemainingDays?: number;
};

export type HighlightStory = {
    id: string;
    userId: string;
    media?: {
        url: string;
        type: string;
        thumbnailUrl?: string;
    };
    text?: string;
    createdAt: string;
    isArchived: boolean;
    highlightCategory?: string;
};

export type StoryHighlight = {
    id: string;
    userId: string;
    title: string;
    coverImageUrl?: string;
    stories: HighlightStory[];
    displayOrder: number;
    viewCount: number;
    createdAt: string;
    updatedAt: string;
};

export interface NoteMusic {
    trackId?: string;
    title: string;
    artist: string;
    coverUrl: string;
    thumbnail?: string;
    audioUrl: string;
    duration?: number;
    muteOriginal?: boolean;
    originalVolume?: number;
    musicVolume?: number;
}

export interface Note {
    id: string;
    userId: string;
    content: string;
    emoji: string;
    location?: string;
    music?: NoteMusic;
    createdAt: string;
    expireAt: string;
}
