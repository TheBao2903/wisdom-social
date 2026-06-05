import apiClient from "@/api/apiClient";
import { Post, User } from "@/types";
import { buildS3Url, uploadMediaAndGetFormat, UploadableMediaFile } from "@/utils/s3";

export type MediaKind = "video" | "image";
export type PrivacyType = "PUBLIC" | "FRIENDS" | "ONLY_ME" | "SPECIFIC" | "EXCEPT";

export type ApiMedia = {
    url: string;
    type?: string;
    order?: number;
    duration?: number;
    width?: number;
    height?: number;
};

export interface MediaUploadMetadataPayload {
    duration?: number;
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    originalFileName?: string;
}

export type CreatePostPayload = {
    content: string;
    privacy?: PrivacyType;
    imageUrls?: string[];
    mediaFiles?: UploadableMediaFile[];
    allowComments?: boolean;
    allowShares?: boolean;
    location?: string | Post["location"];
    taggedUserIds?: string[];
    music?: Post["music"];
};

export type UpdatePostPayload = Partial<Omit<CreatePostPayload, "mediaFiles">> & {
    mediaFiles?: UploadableMediaFile[];
    existingImageUrls?: string[];
};

export type ApiPostData = {
    id: string;
    authorId: string;
    content?: string;
    caption?: string;
    privacy?: PrivacyType;
    media?: ApiMedia[];
    mediaList?: ApiMedia[];
    stats?: { reactCount?: number; commentCount?: number; shareCount?: number };
    createdAt?: string;
    lastActivityAt?: string;
    rankingTime?: string;
    allowComments?: boolean;
    allowShares?: boolean;
    taggedUserIds?: string[];
    music?: Post["music"];
    location?: Post["location"];
    authorSummary?: User;
};

export type CommentData = {
    id: string;
    userId?: string;
    user?: User;
    content?: string;
    text?: string;
    createdAt: string;
    likes?: number;
    parentId?: string | null;
};

export interface FeedCursor {
    lastActivityAt?: string;
    lastPostId?: string;
    prioritizePostId?: string;
}

export interface HomeFeedResult {
    posts: Post[];
    hasNext: boolean;
    nextCursorLastActivityAt: string | null;
    nextCursorPostId: string | null;
}

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=5";

export const detectMediaKind = (url?: string, explicitType?: string): MediaKind => {
    const normalizedType = (explicitType || "").toLowerCase();
    if (normalizedType.includes("video")) return "video";

    const lower = (url || "").toLowerCase();
    if (/\.(mp4|webm|mov|avi|mkv)(\?|#|$)/.test(lower) || lower.includes("/videos/")) {
        return "video";
    }

    return "image";
};

export const isVideoMedia = (url?: string, explicitType?: string): boolean =>
    detectMediaKind(url, explicitType) === "video";

export const formatMediaDuration = (durationSeconds?: number | null): string => {
    const totalSeconds = Math.max(0, Math.floor(Number(durationSeconds || 0)));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const transformMediaToS3Urls = (
    media: Array<{ url: string; type?: string; order?: number }> | undefined,
    authorId: string,
): string[] => {
    if (!media || media.length === 0) return [];

    return media
        .map((m) => {
            const rawUrl = (m?.url || "").toString().trim();
            if (!rawUrl) return "";
            if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

            let key = rawUrl;
            const queryIndex = key.indexOf("?");
            if (queryIndex >= 0) key = key.substring(0, queryIndex);
            const fragmentIndex = key.indexOf("#");
            if (fragmentIndex >= 0) key = key.substring(0, fragmentIndex);

            const normalizedKey = key.startsWith("/") ? key.substring(1) : key;
            if (
                normalizedKey.startsWith("posts/") ||
                normalizedKey.startsWith("images/") ||
                normalizedKey.startsWith("videos/") ||
                normalizedKey.startsWith("files/") ||
                normalizedKey.startsWith("audios/") ||
                normalizedKey.startsWith("users/") ||
                normalizedKey.startsWith("conversations/") ||
                normalizedKey.startsWith("stories/")
            ) {
                return buildS3Url(normalizedKey) || "";
            }

            return buildS3Url(`posts/${authorId}/images/${normalizedKey}`) || "";
        })
        .filter(Boolean);
};

const extractMediaUploadMetadata = (file: UploadableMediaFile): MediaUploadMetadataPayload => ({
    duration: typeof file.duration === "number" ? Math.max(0, Math.floor(file.duration / (file.duration > 1000 ? 1000 : 1))) : undefined,
    width: typeof file.width === "number" ? file.width : undefined,
    height: typeof file.height === "number" ? file.height : undefined,
    fileSize: typeof file.fileSize === "number" ? file.fileSize : undefined,
    mimeType: file.type || file.mimeType || undefined,
    originalFileName: file.name || file.uri.split("/").pop() || undefined,
});

const appendPostFormData = async (
    formData: FormData,
    payload: CreatePostPayload | UpdatePostPayload,
): Promise<void> => {
    const mediaFiles = payload.mediaFiles || [];
    const uploadedImageUrls: string[] = [];
    const mediaMetadatas: MediaUploadMetadataPayload[] = [];

    for (const mediaFile of mediaFiles) {
        mediaMetadatas.push(extractMediaUploadMetadata(mediaFile));
        const uploadedKey = await uploadMediaAndGetFormat(mediaFile);
        uploadedImageUrls.push(uploadedKey);
    }

    const postData = {
        ...(payload.content !== undefined ? { content: payload.content } : {}),
        privacy: payload.privacy || "PUBLIC",
        allowComments: payload.allowComments !== false,
        allowShares: payload.allowShares !== false,
        ...(payload.location !== undefined ? { location: payload.location } : {}),
        taggedUserIds: payload.taggedUserIds || [],
        ...(payload.music ? { music: payload.music } : {}),
        mediaMetadatas,
    };

    formData.append("postData", JSON.stringify(postData));
    const existingImageUrls = "existingImageUrls" in payload ? payload.existingImageUrls || [] : [];
    existingImageUrls.forEach((url: string) => formData.append("imageUrls", url));
    (payload.imageUrls || []).forEach((url: string) => formData.append("imageUrls", url));
    uploadedImageUrls.forEach((url) => formData.append("imageUrls", url));
};

const extractPostsArray = (payload: any): ApiPostData[] => {
    const rawData = payload?.data ?? payload;
    if (Array.isArray(rawData)) return rawData as ApiPostData[];
    if (Array.isArray(rawData?.posts)) return rawData.posts as ApiPostData[];
    if (Array.isArray(rawData?.content)) return rawData.content as ApiPostData[];
    return [];
};

const extractFeedSliceMeta = (payload: any) => {
    const rawData = payload?.data ?? payload;
    return {
        hasNext: Boolean(rawData?.hasNext),
        nextCursorLastActivityAt: rawData?.nextCursorCreatedAt ?? rawData?.nextCursorLastActivityAt ?? null,
        nextCursorPostId: rawData?.nextCursorPostId ?? null,
    };
};

const normalizeUser = (userData: any): User => {
    const id = String(userData?.id ?? "");
    const username = userData?.username || userData?.name || `user${id}`;
    return {
        id,
        username,
        fullName: userData?.fullName || userData?.name || username,
        name: userData?.name || userData?.fullName || username,
        bio: userData?.bio || "",
        avatarUrl: buildS3Url(userData?.avatarUrl) || userData?.avatarUrl || DEFAULT_AVATAR,
        phone: userData?.phone,
        followers: userData?.followersCount || userData?.followers || 0,
        following: userData?.followingCount || userData?.following || 0,
        birthday: userData?.birthday,
        gender: userData?.gender,
        hasPinCode: userData?.hasPinCode,
    };
};

export const normalizePost = (post: ApiPostData | any, userData: any): Post => {
    const rawMedia = post.media || post.mediaList || [];
    const authorId = String(post.authorId || userData?.id || "");
    const images = transformMediaToS3Urls(rawMedia, authorId);
    const media = rawMedia.map((m: any, mediaIndex: number) => ({
        ...m,
        url: images[mediaIndex] || m?.url || "",
        type: (m?.type || detectMediaKind(images[mediaIndex] || m?.url)).toLowerCase(),
        duration: typeof m?.duration === "number" ? m.duration : undefined,
        width: typeof m?.width === "number" ? m.width : undefined,
        height: typeof m?.height === "number" ? m.height : undefined,
    }));
    const user = normalizeUser(userData);

    return {
        id: String(post.id),
        user,
        userId: user.id,
        images,
        image: images[0] || "",
        media,
        caption: post.content || post.caption || "",
        likes: post.stats?.reactCount || post.likes || 0,
        comments: [],
        commentsCount: post.stats?.commentCount || 0,
        shares: post.stats?.shareCount || post.shares || 0,
        createdAt: post.createdAt || new Date().toISOString(),
        lastActivityAt: post.lastActivityAt || post.createdAt || new Date().toISOString(),
        rankingTime: post.rankingTime || post.createdAt || new Date().toISOString(),
        isLiked: Boolean(post.isLiked),
        isSaved: Boolean(post.isSaved),
        privacy: post.privacy || "PUBLIC",
        allowComments: post.allowComments !== false,
        allowShares: post.allowShares !== false,
        taggedUserIds: post.taggedUserIds || [],
        music: post.music,
        location: post.location,
    };
};

export const fetchUserById = async (userId: string | number): Promise<User> => {
    const response = await apiClient.get(`/auth/user/${userId}`);
    const userData = response.data?.data ?? response.data;
    return normalizeUser(userData);
};

export const fetchPostAuthorById = async (userId: string | number): Promise<User> => {
    try {
        const response = await apiClient.get(`/posts/authors/${userId}/summary`);
        const userData = response.data?.data ?? response.data;
        return normalizeUser(userData);
    } catch (error: any) {
        if (error?.response?.status !== 403) {
            throw error;
        }
        return fetchUserById(userId);
    }
};

export const fetchCurrentViewerId = async (): Promise<string> => {
    const response = await apiClient.get("/auth/me");
    const meData = response.data?.data ?? response.data;
    return String(meData?.id ?? "").trim();
};

export const fetchPostById = async (postId: string): Promise<ApiPostData> => {
    const response = await apiClient.get(`/posts/${postId}`);
    const post = response.data?.data ?? response.data;
    if (!post) throw new Error("No post data in response");
    return post;
};

export const fetchPostWithAuthor = async (postId: string): Promise<Post> => {
    const post = await fetchPostById(postId);
    const author = post.authorSummary || await fetchPostAuthorById(post.authorId);
    return normalizePost(post, author);
};

export const fetchHomeFeedPosts = async (
    size = 200,
    cursor?: FeedCursor,
): Promise<HomeFeedResult> => {
    const feedResponse = await apiClient.get("/posts/feed", {
        params: {
            size,
            ...(cursor?.lastActivityAt ? { lastActivityAt: cursor.lastActivityAt } : {}),
            ...(cursor?.lastPostId ? { lastPostId: cursor.lastPostId } : {}),
            ...(cursor?.prioritizePostId ? { prioritizePostId: cursor.prioritizePostId } : {}),
        },
    });

    const allPosts = extractPostsArray(feedResponse.data);
    const meta = extractFeedSliceMeta(feedResponse.data);
    const authorIds = Array.from(
        new Set(allPosts.filter((post) => !post.authorSummary).map((post) => post.authorId).filter(Boolean))
    );

    const authorEntries = await Promise.all(
        authorIds.map(async (authorId) => {
            try {
                const user = await fetchPostAuthorById(authorId);
                return [String(authorId), user] as const;
            } catch {
                return [String(authorId), null] as const;
            }
        }),
    );

    const authorMap = new Map<string, User | null>(authorEntries);
    const posts = allPosts
        .map((post) => {
            const userData = post.authorSummary || authorMap.get(String(post.authorId));
            if (!userData) return null;
            return normalizePost(post, userData);
        })
        .filter(Boolean) as Post[];

    return {
        posts,
        hasNext: meta.hasNext,
        nextCursorLastActivityAt: meta.nextCursorLastActivityAt,
        nextCursorPostId: meta.nextCursorPostId,
    };
};

export const fetchPostComments = async (postId: string): Promise<CommentData[]> => {
    const response = await apiClient.get("/comments", {
        params: { targetType: "POST", targetId: postId },
    });
    const allComments = response.data?.data || [];
    return allComments.filter((comment: CommentData) => !comment.parentId);
};

export const fetchCommentReplies = async (commentId: string): Promise<CommentData[]> => {
    const response = await apiClient.get("/comments", {
        params: { parentId: commentId },
    });
    return response.data?.data || [];
};

export const fetchPostReactionsCount = async (postId: string): Promise<number> => {
    const response = await apiClient.get("/reactions", {
        params: { targetType: "POST", targetId: postId },
    });
    return response.data?.data?.length || 0;
};

export const fetchUserReaction = async (
    userId: string,
    postId: string,
): Promise<{ type: string } | null> => {
    try {
        const response = await apiClient.get("/reactions/user", {
            params: { userId, targetType: "POST", targetId: postId },
        });
        return response.data?.data || null;
    } catch {
        return null;
    }
};

export const checkPostSaved = async (userId: string, postId: string): Promise<boolean> => {
    const response = await apiClient.get("/saved-posts/check", {
        params: { userId, postId },
    });
    return Boolean(response.data?.data);
};

export const submitComment = async (
    userId: string,
    postId: string,
    content: string,
): Promise<CommentData> => {
    const response = await apiClient.post(`/comments?userId=${userId}`, {
        targetType: "POST",
        targetId: postId,
        content,
    });
    return response.data?.data;
};

export const togglePostReaction = async (
    userId: string,
    postId: string,
    reactionType: string,
): Promise<any> => {
    const response = await apiClient.post("/reactions/toggle", null, {
        params: { userId, targetType: "POST", targetId: postId, reactionType },
    });
    return response.data?.data;
};

export const togglePostSaved = async (userId: string, postId: string): Promise<void> => {
    await apiClient.post("/saved-posts/toggle", null, { params: { userId, postId } });
};

export const sharePost = async (postId: string, content = ""): Promise<any> => {
    const response = await apiClient.post("/post-shares", {}, { params: { postId, content } });
    return response.data?.data;
};

export const updatePostPrivacy = async (
    userId: string | number,
    postId: string,
    newPrivacy: PrivacyType,
): Promise<ApiPostData> => {
    const formData = new FormData();
    formData.append("postData", JSON.stringify({ privacy: newPrivacy }));
    const response = await apiClient.put(`/posts/${postId}?userId=${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data?.data;
};

export const deletePost = async (postId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/posts/${postId}?userId=${userId}`);
};

export const createPost = async (
    userId: string | number,
    payload: CreatePostPayload,
): Promise<ApiPostData> => {
    const formData = new FormData();
    await appendPostFormData(formData, payload);

    const response = await apiClient.post(`/posts?userId=${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data?.data;
};

export const updatePost = async (
    userId: string | number,
    postId: string,
    payload: UpdatePostPayload,
): Promise<ApiPostData> => {
    const formData = new FormData();
    await appendPostFormData(formData, payload);

    const response = await apiClient.put(`/posts/${postId}?userId=${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    const updated = response.data?.data;
    if (!updated) throw new Error("No post data in response");
    return updated;
};

export const searchUsers = async (_userId: string, query: string): Promise<User[]> => {
    try {
        const response = await apiClient.get(`/auth/users/username/${query}`);
        const rawUsers = Array.isArray(response.data) ? response.data : response.data?.data || [];
        return rawUsers.map(normalizeUser);
    } catch {
        return [];
    }
};

export const searchMentionUsers = async (
    viewerId: string,
    query: string,
    page = 0,
    size = 10,
): Promise<{ data: User[]; hasMore: boolean }> => {
    try {
        const response = await apiClient.get("/auth/users/mentions", {
            params: { viewerId, query, page, size },
        });
        const paginatedData = response.data?.data ?? response.data;
        return {
            data: (paginatedData?.data || []).map(normalizeUser),
            hasMore: Boolean(paginatedData?.hasMore),
        };
    } catch {
        return { data: [], hasMore: false };
    }
};

const transformProfilePost = async (post: any, fallbackUserId?: string | number): Promise<any> => {
    const authorId = post.authorId || String(fallbackUserId || "");
    let authorData: User | undefined;
    try {
        authorData = post.authorSummary || await fetchPostAuthorById(authorId);
    } catch {
        authorData = undefined;
    }
    const rawMedia = post.media || post.mediaList || [];
    const images = transformMediaToS3Urls(rawMedia, String(authorId));
    const media = rawMedia.map((m: any, index: number) => ({
        ...m,
        url: images[index] || m?.url || "",
        type: (m?.type || detectMediaKind(images[index] || m?.url)).toLowerCase(),
        duration: typeof m?.duration === "number" ? m.duration : undefined,
        width: typeof m?.width === "number" ? m.width : undefined,
        height: typeof m?.height === "number" ? m.height : undefined,
    }));

    return {
        id: String(post.id),
        imageUrl: images[0] || null,
        likes: post.stats?.reactCount || post.likes || 0,
        comments: post.stats?.commentCount || post.comments || 0,
        caption: post.content || post.caption || "",
        privacy: post.privacy,
        allowComments: post.allowComments !== false,
        allowShares: post.allowShares !== false,
        images,
        media,
        user: authorData,
    };
};

export const getSavedPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    const savedResponse = await apiClient.get("/saved-posts/user", { params: { userId } });
    const savedPostsData = savedResponse.data?.data || [];
    const posts = await Promise.all(
        savedPostsData.map(async (savedPost: any) => {
            try {
                const postResponse = await apiClient.get(`/posts/${savedPost.targetId}`);
                return transformProfilePost(postResponse.data?.data ?? postResponse.data, userId);
            } catch {
                return null;
            }
        }),
    );
    return posts.filter(Boolean);
};

export const fetchSavedPostIds = async (userId: string | number): Promise<string[]> => {
    try {
        const savedResponse = await apiClient.get("/saved-posts/user", { params: { userId } });
        const savedPostsData = savedResponse.data?.data || [];
        return savedPostsData.map((item: any) => String(item.targetId));
    } catch {
        return [];
    }
};

export const getTaggedPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    const response = await apiClient.get(`/posts/tagged/${userId}`);
    const postsData = extractPostsArray(response.data);
    const posts = await Promise.all(postsData.map((post) => transformProfilePost(post, userId)));
    return posts.filter(Boolean);
};

export const getSharedPostsWithDetails = async (userId: string | number): Promise<any[]> => {
    try {
        const response = await apiClient.get(`/post-shares/user/${userId}`);
        const sharesData = response.data?.data || [];
        const posts = await Promise.all(
            sharesData.map(async (share: any) => {
                try {
                    const postResponse = await apiClient.get(`/posts/${share.originalPostId}`);
                    const transformed = await transformProfilePost(postResponse.data?.data ?? postResponse.data, userId);
                    return { ...transformed, shareId: share.id, shareContent: share.content };
                } catch {
                    return null;
                }
            }),
        );
        return posts.filter(Boolean);
    } catch {
        return [];
    }
};

export const getUserPostsWithDetails = async (userId: string | number, page = 0, size = 50): Promise<any[]> => {
    try {
        const response = await apiClient.get(`/posts/user/${userId}`, { params: { page, size } });
        const postsData = extractPostsArray(response.data);
        const posts = await Promise.all(postsData.map((post) => transformProfilePost(post, userId)));
        return posts.filter(Boolean);
    } catch {
        return [];
    }
};

export const getUserPostsCount = async (userId: string | number): Promise<number> => {
    try {
        const response = await apiClient.get(`/posts/user/${userId}/count`);
        const countData = response.data?.data ?? response.data;
        const count = typeof countData === "number" ? countData : Number(countData);
        return Number.isFinite(count) ? count : 0;
    } catch {
        return 0;
    }
};

export async function fakeCreatePost(post: Post): Promise<Post> {
    return post;
}

