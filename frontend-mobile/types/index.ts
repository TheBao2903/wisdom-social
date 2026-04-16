export type User = {
    id: string;
    username: string;
    fullName: string;
    bio: string;
    avatar: string;
    followers: number;
    following: number;
    website?: string;
};

export type Story = {
    id: string;
    userId: string;
    image: string;
    viewed: boolean;
    createdAt: string;
};

export type Comment = {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
};

export type Post = {
    id: string;
    userId: string;
    image: string;
    caption: string;
    likes: number;
    comments: Comment[];
    createdAt: string;
};

export type AppNotification = {
    id: string;
    type: "like" | "follow" | "comment" | "mention";
    userId: string;
    postId?: string;
    message: string;
    createdAt: string;
    read: boolean;
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
};
