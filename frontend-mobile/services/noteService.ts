import apiClient from "@/api/apiClient";
import type { Note } from "@/types";

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

export const noteService = {
    getNoteByUserId: async (userId: string): Promise<Note | null> => {
        try {
            const res = await apiClient.get<ApiResponse<Note | null>>(`/notes/user/${userId}`);
            return normalizeNote(res.data.data);
        } catch (error) {
            console.error("Failed to fetch user note", error);
            return null;
        }
    },

    saveNote: async (payload: SaveNoteRequest): Promise<Note> => {
        const res = await apiClient.post<ApiResponse<Note>>("/notes", payload);
        return normalizeNote(res.data.data) as Note;
    },

    deleteNoteById: async (noteId: string): Promise<void> => {
        await apiClient.delete(`/notes/${noteId}`);
    },
};
