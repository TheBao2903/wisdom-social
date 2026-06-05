import apiClient from "@/api/apiClient";
import { PrivacyType, Story, StoryGroup, StoryViewerInfo, User } from "@/types";
import { buildS3Url } from "@/utils/s3";

export type StorySettingsPayload = {
    allowReplies?: boolean;
    allowReactions?: boolean;
    allowSharing?: boolean;
};

export type CreateStoryPayload = {
    content?: string;
    privacy?: PrivacyType;
    mediaUrls?: string[];
    musicId?: string;
    musicStartTime?: number;
    muteOriginal?: boolean;
    allowReplies?: boolean;
    allowReactions?: boolean;
    allowSharing?: boolean;
    textLayers?: any[];
    musicStickers?: any[];
};

type PresignedUploadResponse = {
    presignedUrl: string;
    objectKey: string;
    fileName: string;
};

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=5";

const unwrap = (payload: any) => payload?.data ?? payload;

const extractStoryArray = (payload: any): any[] => {
    const raw = unwrap(payload);
    if (Array.isArray(raw?.content)) return raw.content;
    if (Array.isArray(raw?.data?.content)) return raw.data.content;
    if (Array.isArray(raw?.stories)) return raw.stories;
    if (Array.isArray(raw)) return raw;
    return [];
};

const normalizeStoryUser = (userData: any, fallbackUserId: string): User | undefined => {
    if (!userData && !fallbackUserId) return undefined;
    const id = String(userData?.id ?? fallbackUserId);
    const username = userData?.username || userData?.name || `user${id}`;
    return {
        id,
        username,
        fullName: userData?.fullName || userData?.name || username,
        name: userData?.name || userData?.fullName || username,
        bio: userData?.bio || "",
        avatarUrl: buildS3Url(userData?.avatarUrl) || userData?.avatarUrl || DEFAULT_AVATAR,
        avatar: buildS3Url(userData?.avatarUrl) || userData?.avatarUrl || DEFAULT_AVATAR,
        followers: userData?.followersCount || userData?.followers || 0,
        following: userData?.followingCount || userData?.following || 0,
        phone: userData?.phone,
    };
};

export const normalizeStory = (story: any): Story => {
    const userId = String(story?.userId ?? story?.authorId ?? story?.user?.id ?? "");
    const media = story?.media
        ? {
            ...story.media,
            url: buildS3Url(story.media.url) || story.media.url || "",
            thumbnailUrl: buildS3Url(story.media.thumbnailUrl) || story.media.thumbnailUrl,
            type: String(story.media.type || "IMAGE").toUpperCase(),
            duration_ms: story.media.duration_ms,
        }
        : story?.image
            ? { url: buildS3Url(story.image) || story.image, type: "IMAGE" }
            : undefined;

    const image = media?.url || buildS3Url(story?.image) || story?.image || "";

    // Normalize text_layers from backend (new format)
    const text_layers = story?.text_layers
        ? story.text_layers.map((layer: any) => ({
            id: layer.id,
            content: layer.content,
            x_pct: layer.x_pct ?? 0.5,
            y_pct: layer.y_pct ?? 0.5,
            width_pct: layer.width_pct,
            height_pct: layer.height_pct,
            style: {
                fontSize: layer.style?.fontSize ?? 16,
                fontFamily: layer.style?.fontFamily ?? "Arial",
                color: layer.style?.color ?? "#FFFFFF",
                align: layer.style?.align ?? "center",
                rotation: layer.style?.rotation,
                bold: layer.style?.bold,
                shadow: layer.style?.shadow,
            },
            z_index: layer.z_index ?? 1,
        }))
        : undefined;

    // Normalize music_stickers from backend (new format)
    const music_stickers = story?.music_stickers
        ? story.music_stickers.map((sticker: any) => ({
            id: sticker.id,
            x_pct: sticker.x_pct ?? 0.5,
            y_pct: sticker.y_pct ?? 0.5,
            width_pct: sticker.width_pct,
            height_pct: sticker.height_pct,
            rotation_deg: sticker.rotation_deg ?? 0,
            style: sticker.style ?? "rectangle",
            meta: {
                track_id: sticker.meta?.track_id ?? "",
                title: sticker.meta?.title ?? "",
                artist: sticker.meta?.artist ?? "",
                cover_url: sticker.meta?.cover_url,
                start_sec: sticker.meta?.start_sec,
                end_sec: sticker.meta?.end_sec,
            },
            z_index: sticker.z_index ?? 1,
        }))
        : undefined;

    return {
        id: String(story?.id),
        userId,
        image,
        viewed: Boolean(story?.viewed ?? story?.isViewed),
        isViewed: Boolean(story?.isViewed ?? story?.viewed),
        createdAt: story?.createdAt || new Date().toISOString(),
        text: story?.text || story?.content || "",
        content: story?.content || story?.text || "",
        media,
        user: normalizeStoryUser(story?.user, userId),
        music: story?.music,
        textStyle: story?.textStyle,
        text_layers,
        music_stickers,
        duration_ms: story?.duration_ms,
        privacy: story?.privacy || "PUBLIC",
        allowReplies: story?.allowReplies !== false,
        allowReactions: story?.allowReactions !== false,
        allowSharing: story?.allowSharing !== false,
        viewCount: story?.viewCount || story?.viewsCount || 0,
    };
};

export const getStoryPresignedUploadUrl = async (
    extension: string,
    originalFilename?: string,
    contentType?: string,
): Promise<PresignedUploadResponse> => {
    const response = await apiClient.get("/stories/upload-url", {
        params: {
            extension,
            ...(originalFilename ? { originalFilename } : {}),
            ...(contentType ? { contentType } : {}),
        },
    });
    const data = unwrap(response.data);
    if (!data?.presignedUrl || !data?.objectKey) {
        throw new Error("Missing required fields: presignedUrl, objectKey");
    }
    return {
        presignedUrl: data.presignedUrl,
        objectKey: data.objectKey,
        fileName: data.fileName || originalFilename || "",
    };
};

export const uploadStoryMediaToS3 = async (
    presignedUrl: string,
    file: { uri: string; name?: string; type?: string },
): Promise<void> => {
    const fileResponse = await fetch(file.uri);
    const blob = await fileResponse.blob();
    const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "application/octet-stream",
        },
        body: blob,
    });
    if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
};

export const uploadStoryMediaAndGetFormat = async (
    file: { uri: string; name?: string; type?: string },
): Promise<string> => {
    const fallbackName = file.uri.split("/").pop() || `story-${Date.now()}.jpg`;
    const fileName = file.name || fallbackName;
    const extension = fileName.split(".").pop() || (file.type?.includes("video") ? "mp4" : "jpg");
    const { presignedUrl, objectKey } = await getStoryPresignedUploadUrl(
        extension,
        fileName,
        file.type || "application/octet-stream",
    );
    await uploadStoryMediaToS3(presignedUrl, { ...file, name: fileName });
    return objectKey;
};

export const createStory = async (payload: CreateStoryPayload): Promise<Story> => {
    const formData = new FormData();
    if (payload.content) formData.append("content", payload.content);
    formData.append("privacy", payload.privacy || "PUBLIC");
    (payload.mediaUrls || []).forEach((url) => formData.append("mediaUrls", url));
    if (payload.musicId) formData.append("musicId", payload.musicId);
    if (payload.musicStartTime !== undefined) formData.append("musicStartTime", String(Math.round(payload.musicStartTime)));
    if (payload.muteOriginal !== undefined) formData.append("muteOriginal", String(payload.muteOriginal));
    if (payload.allowReplies !== undefined) formData.append("allowReplies", String(payload.allowReplies));
    if (payload.allowReactions !== undefined) formData.append("allowReactions", String(payload.allowReactions));
    if (payload.allowSharing !== undefined) formData.append("allowSharing", String(payload.allowSharing));
    if (payload.textLayers && payload.textLayers.length > 0) formData.append("text_layers", JSON.stringify(payload.textLayers));
    if (payload.musicStickers && payload.musicStickers.length > 0) formData.append("music_stickers", JSON.stringify(payload.musicStickers));

    const response = await apiClient.post("/stories", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return normalizeStory(unwrap(response.data));
};

export const fetchUserStories = async (userId: string): Promise<Story[]> => {
    const response = await apiClient.get(`/stories/user/${userId}`);
    return extractStoryArray(response.data).map(normalizeStory);
};

export const fetchStoryFeed = async (page = 0, size = 20): Promise<Story[]> => {
    const response = await apiClient.get("/stories/feed", { params: { page, size } });
    return extractStoryArray(response.data).map(normalizeStory);
};

export const deleteStory = async (storyId: string): Promise<void> => {
    await apiClient.delete(`/stories/${storyId}`);
};

export const reactToStory = async (storyId: string, emoji?: string): Promise<void> => {
    await apiClient.post(`/stories/${storyId}/react`, null, {
        params: emoji ? { emoji } : undefined,
    });
};

export const viewStory = async (storyId: string): Promise<void> => {
    try {
        await apiClient.post(`/stories/${storyId}/view`);
    } catch {
        // Giống web: ghi nhận view là best-effort, không phá trải nghiệm xem story.
    }
};

export const fetchStoryViewers = async (storyId: string): Promise<StoryViewerInfo[]> => {
    const response = await apiClient.get(`/stories/${storyId}/viewers`);
    const data = unwrap(response.data);
    return Array.isArray(data) ? data : [];
};

export const updateStoryPrivacy = async (storyId: string, privacy: PrivacyType): Promise<any> => {
    const response = await apiClient.put(`/stories/${storyId}/privacy`, null, { params: { privacy } });
    return unwrap(response.data);
};

export const updateStorySettings = async (storyId: string, settings: StorySettingsPayload): Promise<any> => {
    const response = await apiClient.put(`/stories/${storyId}/settings`, null, { params: settings });
    return unwrap(response.data);
};

export const groupStoriesByUser = (stories: Story[], currentUser?: User | null): StoryGroup[] => {
    const grouped = new Map<string, Story[]>();
    stories.forEach((story) => {
        if (!story.userId) return;
        const list = grouped.get(story.userId) || [];
        list.push(story);
        grouped.set(story.userId, list);
    });

    const myId = currentUser?.id ? String(currentUser.id) : undefined;
    const groups = Array.from(grouped.entries()).map(([userId, userStories]) => {
        const first = userStories[0];
        const isMe = myId === String(userId);
        return {
            userId,
            username: isMe
                ? currentUser?.username || currentUser?.name || "Tin của bạn"
                : first.user?.username || `User ${userId.slice(0, 6)}`,
            userAvatar: isMe
                ? currentUser?.avatarUrl || currentUser?.avatar || ""
                : first.user?.avatarUrl || first.user?.avatar || "",
            stories: userStories,
        };
    });

    return groups.sort((a, b) => {
        if (myId && a.userId === myId) return -1;
        if (myId && b.userId === myId) return 1;
        const aViewed = a.stories.length > 0 && a.stories.every((story) => story.isViewed || story.viewed);
        const bViewed = b.stories.length > 0 && b.stories.every((story) => story.isViewed || story.viewed);
        if (aViewed && !bViewed) return 1;
        if (!aViewed && bViewed) return -1;
        return 0;
    });
};
