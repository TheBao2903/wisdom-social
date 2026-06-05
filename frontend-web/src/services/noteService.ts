import axiosClient from "../api/axiosClient";
import type { Note } from "../types/note";
import type { MusicMetadata } from "./musicService";

interface ApiResponse<T> {
    status: number;
    success: boolean;
    message: string;
    data: T;
}

export interface SaveNoteRequest {
    userId: string;
    content?: string;
    location?: string;
    trackId?: string;
    musicTitle?: string;
    musicArtist?: string;
    musicPreviewUrl?: string;
    musicCoverUrl?: string;
}

const normalizeNote = (raw: any): Note | null => {
    if (!raw) return null;

    const normalizedMusic = raw.music
        ? {
            ...raw.music,
            coverUrl: raw.music.coverUrl || raw.music.thumbnail || "",
        }
        : undefined;

    return {
        ...raw,
        music: normalizedMusic,
    } as Note;
};

export const getNoteByUserId = async (userId: string): Promise<Note | null> => {
    try {
        const res = await axiosClient.get<ApiResponse<Note | null>>(`/notes/user/${userId}`);
        return normalizeNote(res.data.data);
    } catch (error) {
        console.error("Failed to fetch user note", error);
        return null;
    }
};

export const buildSaveNoteRequest = (
    userId: string,
    content: string,
    location: string,
    selectedMusic: MusicMetadata | null
): SaveNoteRequest => {
    const body: SaveNoteRequest = { userId };

    if (content.trim()) body.content = content.trim();
    if (location.trim()) body.location = location.trim();

    if (selectedMusic) {
        if (selectedMusic.id?.trim()) {
            body.trackId = selectedMusic.id;
        }
        body.musicTitle = selectedMusic.title;
        body.musicArtist = selectedMusic.artist;
        body.musicPreviewUrl = selectedMusic.audioUrl;
        body.musicCoverUrl = selectedMusic.imageUrl;
    }

    return body;
};

export const saveNote = async (payload: SaveNoteRequest): Promise<Note> => {
    const res = await axiosClient.post<ApiResponse<Note>>("/notes", payload);
    return normalizeNote(res.data.data) as Note;
};

export const deleteNoteById = async (noteId: string): Promise<void> => {
    await axiosClient.delete(`/notes/${noteId}`);
};
