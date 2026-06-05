import { useEffect, useState } from "react";
import type { Note } from "@/types";
import { noteService } from "@/services/noteService";

interface UseProfileNoteResult {
    note: Note | null;
    showNoteModal: boolean;
    openNoteModal: () => void;
    closeNoteModal: () => void;
    setNote: (updated: Note | null) => void;
}

export const useProfileNote = (userId?: number | string): UseProfileNoteResult => {
    const [note, setNote] = useState<Note | null>(null);
    const [showNoteModal, setShowNoteModal] = useState(false);

    useEffect(() => {
        if (!userId) return;

        noteService.getNoteByUserId(String(userId))
            .then((fetched) => setNote(fetched))
            .catch(() => setNote(null));
    }, [userId]);

    return {
        note,
        showNoteModal,
        openNoteModal: () => setShowNoteModal(true),
        closeNoteModal: () => setShowNoteModal(false),
        setNote,
    };
};

export default useProfileNote;
