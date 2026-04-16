/**
 * Post Related Types
 */

export interface PostData {
    id: string;
    authorId: string;
    content: string;
    privacy?: string;
    media?: Array<{ url: string; type: string; order: number }>;
    mediaList?: Array<{ url: string; type: string; order: number }>;
    stats?: { reactCount: number; commentCount: number; shareCount: number };
    createdAt: string;
    location?:
    | string
    | {
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        placeId: string;
    };
    taggedUserIds?: string[];
}

export interface UserData {
    id: number;
    username: string;
    name: string;
    avatarUrl: string;
}

export interface CommentData {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    reactCount: number;
    replyCount: number;
    parentId?: string;
    replies?: CommentData[];
}

export interface PostModalProps {
    postId: string;
    onClose: () => void;
}
