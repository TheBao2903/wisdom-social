import axiosClient from "../api/axiosClient";
import { buildS3Url } from "../utils/s3";

export interface MusicMetadata {
    id: string;
    title: string;
    artist: string;
    duration: number;
    imageUrl: string;
    audioUrl: string;
    createdAt: string;
}

interface MusicPage {
    content: MusicMetadata[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
}

interface ApiResponse<T> {
    status: number;
    success: boolean;
    message: string;
    data: T;
}

/**
 * Fetch all music tracks with pagination
 * @param page page number (0-indexed)
 * @param size page size (default: 20)
 * @returns tracks and hasMore boolean
 */
export const getAllMusic = async (
    page: number = 0,
    size: number = 20
): Promise<{ tracks: MusicMetadata[]; hasMore: boolean }> => {
    try {
        const res = await axiosClient.get<ApiResponse<MusicPage>>(
            `/music?page=${page}&size=${size}`
        );
        const data = res.data.data;
        const tracks = data?.content || [];
        const totalPages = data?.totalPages ?? 1;
        const hasMore = page < totalPages - 1;
        return { tracks, hasMore };
    } catch (error) {
        console.error("Error fetching music:", error);
        return { tracks: [], hasMore: false };
    }
};

/**
 * Search music by title
 * @param title search term
 * @param page page number (0-indexed)
 * @param size page size (default: 20)
 */
export const searchMusicByTitle = async (
    title: string,
    page: number = 0,
    size: number = 20
): Promise<{ tracks: MusicMetadata[]; hasMore: boolean }> => {
    if (!title.trim()) return { tracks: [], hasMore: false };
    try {
        const res = await axiosClient.get<ApiResponse<MusicMetadata[]>>(
            `/music/search/title?title=${encodeURIComponent(title)}&page=${page}&size=${size}`
        );
        return { tracks: res.data.data || [], hasMore: false };
    } catch (error) {
        console.error("Error searching music by title:", error);
        return { tracks: [], hasMore: false };
    }
};

/**
 * Search music by artist
 * @param artist search term
 * @param page page number (0-indexed)
 * @param size page size (default: 20)
 */
export const searchMusicByArtist = async (
    artist: string,
    page: number = 0,
    size: number = 20
): Promise<{ tracks: MusicMetadata[]; hasMore: boolean }> => {
    if (!artist.trim()) return { tracks: [], hasMore: false };
    try {
        const res = await axiosClient.get<ApiResponse<MusicMetadata[]>>(
            `/music/search/artist?artist=${encodeURIComponent(artist)}&page=${page}&size=${size}`
        );
        return { tracks: res.data.data || [], hasMore: false };
    } catch (error) {
        console.error("Error searching music by artist:", error);
        return { tracks: [], hasMore: false };
    }
};

/**
 * Get music by ID
 */
export const getMusicById = async (musicId: string): Promise<MusicMetadata | null> => {
    try {
        const res = await axiosClient.get<ApiResponse<MusicMetadata>>(
            `/music/${musicId}`
        );
        return res.data.data || null;
    } catch (error) {
        console.error("Error fetching music by id:", error);
        return null;
    }
};

/**
 * Format duration from seconds to MM:SS
 */
export const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Resolve music media path/object key to a fully-qualified URL.
 */
export const resolveMusicMediaUrl = (
    mediaPath: string | null | undefined
): string => {
    return buildS3Url(mediaPath) || "";
};

// Audio playback state management
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
const listeners = new Set<(url: string | null) => void>();

/**
 * Subscribe to playback state changes.
 */
export const subscribeToPlayback = (callback: (url: string | null) => void) => {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
};

const notifyListeners = () => {
    listeners.forEach((cb) => cb(currentUrl));
};

/**
 * Stop current preview audio if any.
 */
export const stopAudioPreview = (): void => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
        currentAudio = null;
        currentUrl = null;
        notifyListeners();
    }
};

/**
 * Create and play a preview audio instance.
 */
export const playAudioPreview = (
    url: string,
    options?: {
        onEnded?: () => void;
        onTimeUpdate?: (audio: HTMLAudioElement) => void;
        onLoadedMetadata?: (audio: HTMLAudioElement) => void;
    }
): HTMLAudioElement | null => {
    if (!url) return null;

    stopAudioPreview();

    const audio = new Audio(url);
    currentAudio = audio;
    currentUrl = url;
    notifyListeners();

    if (options?.onEnded) {
        audio.onended = () => {
            options.onEnded?.();
            if (currentAudio === audio) {
                currentAudio = null;
                currentUrl = null;
                notifyListeners();
            }
        };
    }
    if (options?.onTimeUpdate) {
        audio.ontimeupdate = () => options.onTimeUpdate?.(audio);
    }
    if (options?.onLoadedMetadata) {
        audio.onloadedmetadata = () => options.onLoadedMetadata?.(audio);
    }

    audio.play().catch((err) => {
        console.error("Error playing audio:", err);
        if (currentAudio === audio) currentAudio = null;
    });

    return audio;
};