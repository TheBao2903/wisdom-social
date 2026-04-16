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
}

// Post Types
export type PrivacyType = "PUBLIC" | "FRIENDS" | "ONLY_ME" | "SPECIFIC" | "EXCEPT";

export interface Post {
    id: string;
    user: User;
    images: string[];
    caption: string;
    likes: number;
    comments: Comment[];
    createdAt: string;
    isLiked?: boolean;
    isSaved?: boolean;
    privacy?: PrivacyType;
}

export interface Comment {
    id: string;
    user: User;
    text: string;
    createdAt: string;
    likes: number;
}

// Story Types
export interface Story {
    id: string;
    user: User;
    image: string;
    createdAt: string;
    isViewed?: boolean;
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
export type NotificationType = 'like' | 'comment' | 'follow' | 'mention';

export interface Notification {
    id: string;
    type: NotificationType;
    user: User;
    post?: Post;
    text: string;
    createdAt: string;
    isRead?: boolean;
}