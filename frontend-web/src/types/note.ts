export interface NoteMusic {
    trackId?: string;
    title: string;
    artist: string;
    coverUrl: string;
    thumbnail?: string;
    audioUrl: string;
    duration?: number;
    muteOriginal?: boolean;
    originalVolume?: number;
    musicVolume?: number;
}

export interface Note {
    id: string;
    userId: string;
    content: string;
    emoji: string;
    location?: string;
    music?: NoteMusic;
    createdAt: string;
    expireAt: string;
}

export interface NoteModalProps {
    userId: string;
    isOwnProfile: boolean;
    onClose: () => void;
    onNoteChange?: (note: Note | null) => void;
}
