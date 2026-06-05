import { Audio } from "expo-av";
import apiClient from "@/api/apiClient";
import { buildS3Url } from "@/utils/s3";

export type MusicMetadata = {
    id: string;
    title: string;
    artist: string;
    duration: number;
    imageUrl?: string;
    audioUrl: string;
    createdAt?: string;
};

type MusicResponse = {
    content?: MusicMetadata[];
    totalElements?: number;
    totalPages?: number;
    currentPage?: number;
    hasMore?: boolean;
};

const unwrap = (payload: any) => payload?.data ?? payload;

const normalizeMusic = (item: any): MusicMetadata => ({
    id: String(item?.id ?? item?.trackId ?? ""),
    title: item?.title || "Unknown Track",
    artist: item?.artist || "Unknown Artist",
    duration: Number(item?.duration ?? 0),
    imageUrl: buildS3Url(item?.imageUrl || item?.coverUrl || item?.thumbnail) || item?.imageUrl || item?.coverUrl || item?.thumbnail,
    audioUrl: buildS3Url(item?.audioUrl) || item?.audioUrl || "",
    createdAt: item?.createdAt,
});

const extractMusicArray = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    return [];
};

const extractHasMore = (payload: any, currentPage: number): boolean => {
    if (typeof payload?.hasMore === "boolean") return payload.hasMore;
    if (typeof payload?.totalPages === "number") {
        return currentPage < payload.totalPages - 1;
    }
    return false;
};

export const getAllMusic = async (page = 0, size = 20): Promise<{ tracks: MusicMetadata[]; hasMore: boolean }> => {
    try {
        const response = await apiClient.get("/music", { params: { page, size } });
        const raw = unwrap(response.data);
        const tracks = extractMusicArray(raw).map(normalizeMusic).filter((track: MusicMetadata) => track.id && track.audioUrl);
        const hasMore = extractHasMore(raw, page);
        return { tracks, hasMore };
    } catch {
        return { tracks: [], hasMore: false };
    }
};

export const searchMusicByTitle = async (
    title: string,
    page = 0,
    size = 20
): Promise<{ tracks: MusicMetadata[]; hasMore: boolean }> => {
    const query = title.trim();
    if (!query) return { tracks: [], hasMore: false };
    try {
        const response = await apiClient.get("/music/search/title", { params: { title: query, page, size } });
        const raw = unwrap(response.data);
        const tracks = extractMusicArray(raw).map(normalizeMusic).filter((track: MusicMetadata) => track.id && track.audioUrl);
        const hasMore = extractHasMore(raw, page);
        return { tracks, hasMore };
    } catch {
        return { tracks: [], hasMore: false };
    }
};

export const searchMusicByArtist = async (
    artist: string,
    page = 0,
    size = 20
): Promise<{ tracks: MusicMetadata[]; hasMore: boolean }> => {
    const query = artist.trim();
    if (!query) return { tracks: [], hasMore: false };
    try {
        const response = await apiClient.get("/music/search/artist", { params: { artist: query, page, size } });
        const raw = unwrap(response.data);
        const tracks = extractMusicArray(raw).map(normalizeMusic).filter((track: MusicMetadata) => track.id && track.audioUrl);
        const hasMore = extractHasMore(raw, page);
        return { tracks, hasMore };
    } catch {
        return { tracks: [], hasMore: false };
    }
};

export const getMusicById = async (musicId: string): Promise<MusicMetadata | null> => {
    try {
        const response = await apiClient.get(`/music/${musicId}`);
        const data = unwrap(response.data);
        return data ? normalizeMusic(data) : null;
    } catch {
        return null;
    }
};

export const formatDuration = (seconds?: number): string => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const resolveMusicMediaUrl = (mediaPath?: string | null): string => buildS3Url(mediaPath) || "";

// Audio playback state management
let currentSound: Audio.Sound | null = null;
let currentUrl: string | null = null;
type PlaybackCallback = (url: string | null, isPlaying: boolean) => void;
const listeners = new Set<PlaybackCallback>();

const notifyListeners = () => {
    listeners.forEach((cb) => cb(currentUrl, currentSound !== null));
};

export const subscribeToPlayback = (callback: PlaybackCallback) => {
    listeners.add(callback);
    callback(currentUrl, currentSound !== null);
    return () => {
        listeners.delete(callback);
    };
};

export const stopAudioPreview = async (): Promise<void> => {
    if (!currentSound) return;
    const sound = currentSound;
    currentSound = null;
    currentUrl = null;
    notifyListeners();
    await sound.stopAsync().catch(() => undefined);
    await sound.unloadAsync().catch(() => undefined);
};

export const playAudioPreview = async (
    url: string,
    options?: { onEnded?: () => void },
): Promise<Audio.Sound | null> => {
    if (!url) return null;

    await stopAudioPreview();

    try {
        const { sound } = await Audio.Sound.createAsync(
            { uri: url },
            { shouldPlay: true, volume: 0.8 }
        );
        currentSound = sound;
        currentUrl = url;
        notifyListeners();

        sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
                if (currentSound === sound) {
                    currentSound = null;
                    currentUrl = null;
                    notifyListeners();
                }
                options?.onEnded?.();
                void sound.unloadAsync().catch(() => undefined);
            }
        });
        return sound;
    } catch (error) {
        console.error("[MusicService] Error creating audio:", error);
        return null;
    }
};