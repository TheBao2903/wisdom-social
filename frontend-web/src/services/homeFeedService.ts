import axiosClient from "../api/axiosClient";
import { fetchPostAuthorById, transformMediaToS3Urls } from "./postService";
import { buildS3Url } from "../utils/s3";
import type { Post } from "../types";

interface FeedPostData {
    id: string;
    authorId: string;
    content: string;
    privacy?: string;
    media?: Array<{
        url: string;
        type: string;
        order: number;
        duration?: number;
        width?: number;
        height?: number;
    }>;
    stats?: { reactCount: number; commentCount: number; shareCount: number };
    createdAt: string;
    lastActivityAt?: string;
    rankingTime?: string;
    taggedUserIds?: string[];
    authorSummary?: any;
}

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

const extractPostsArray = (payload: any): FeedPostData[] => {
    const rawData = payload?.data ?? payload;
    if (Array.isArray(rawData)) {
        return rawData as FeedPostData[];
    }
    if (Array.isArray(rawData?.posts)) {
        return rawData.posts as FeedPostData[];
    }
    if (Array.isArray(rawData?.content)) {
        return rawData.content as FeedPostData[];
    }
    return [];
};

const extractFeedSliceMeta = (payload: any) => {
    const rawData = payload?.data ?? payload;
    return {
        hasNext: Boolean(rawData?.hasNext),
        nextCursorLastActivityAt: rawData?.nextCursorCreatedAt ?? null,
        nextCursorPostId: rawData?.nextCursorPostId ?? null,
    };
};

export const normalizePost = (post: any, userData: any): Post => {
    // Determine the media array (handle multiple possible property names)
    const rawMedia = post.media || post.mediaList || [];

    // Determine authorId (from post or from userData)
    const authorId = post.authorId || userData?.id?.toString();

    const transformedImages = transformMediaToS3Urls(rawMedia, authorId);
    const transformedMedia = rawMedia.map((m: any, mediaIndex: number) => ({
        url: transformedImages[mediaIndex] || "",
        type: (m.type || "image").toLowerCase(),
        duration: typeof m.duration === "number" ? m.duration : undefined,
    }));

    return {
        id: post.id,
        user: {
            id: userData.id,
            username: userData.username,
            // Handle both raw user (name) and normalized user (fullName)
            fullName: userData.fullName || userData.name || userData.username,
            avatarUrl:
                userData.avatarUrl && userData.avatarUrl.startsWith("http")
                    ? userData.avatarUrl
                    : (buildS3Url(userData.avatarUrl) || userData.avatarUrl || "https://i.pravatar.cc/150?img=5"),
        },
        images: transformedImages.filter(Boolean), // UI-friendly array (no empty strings)
        media: transformedMedia,
        caption: post.content || post.caption || "",
        privacy: (post.privacy as any) || "PUBLIC",
        allowComments: post.allowComments !== false,
        allowShares: post.allowShares !== false,
        likes: post.stats?.reactCount || 0,
        comments: [],
        createdAt: post.createdAt || new Date().toISOString(),
        lastActivityAt: post.lastActivityAt || post.createdAt || new Date().toISOString(),
        rankingTime: post.rankingTime || post.createdAt || new Date().toISOString(),
        isLiked: false,
        isSaved: false,
        taggedUserIds: post.taggedUserIds || [],
        music: post.music
            ? {
                trackId: post.music.trackId,
                title: post.music.title || "",
                artist: post.music.artist || "",
                coverUrl: post.music.coverUrl || post.music.thumbnail || "",
                thumbnail: post.music.thumbnail,
                audioUrl: post.music.audioUrl || "",
                duration: post.music.duration,
                muteOriginal: post.music.muteOriginal,
                originalVolume: post.music.originalVolume,
                musicVolume: post.music.musicVolume,
            }
            : undefined,
        location: post.location,
    } as Post;
};

export const fetchHomeFeedPosts = async (
    size: number = 200,
    cursor?: FeedCursor
): Promise<HomeFeedResult> => {
    const feedResponse = await axiosClient.get("/posts/feed", {
        params: {
            size,
            ...(cursor?.lastActivityAt ? { lastActivityAt: cursor.lastActivityAt } : {}),
            ...(cursor?.lastPostId ? { lastPostId: cursor.lastPostId } : {}),
            ...(cursor?.prioritizePostId ? { prioritizePostId: cursor.prioritizePostId } : {}),
        },
    });

    const allPosts = extractPostsArray(feedResponse.data);
    const meta = extractFeedSliceMeta(feedResponse.data);

    // Backend handles sorting and prioritization
    // allPosts.sort(
    //     (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    // );

    const authorIds = Array.from(
        new Set(allPosts.filter((post) => !post.authorSummary).map((post) => post.authorId).filter(Boolean))
    );

    const authorEntries = await Promise.all(
        authorIds.map(async (authorId) => {
            try {
                const authorData = await fetchPostAuthorById(authorId);
                return [authorId, authorData] as const;
            } catch (userErr: any) {
                console.error("Error fetching author", authorId, userErr?.message);
                return [authorId, null] as const;
            }
        })
    );

    const authorMap = new Map<string, any>(authorEntries);

    const posts = allPosts
        .map((post) => {
            const userData = post.authorSummary || authorMap.get(post.authorId);
            if (!userData) {
                return null;
            }

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
