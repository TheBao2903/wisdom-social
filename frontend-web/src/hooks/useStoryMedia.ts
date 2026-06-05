import { useState, useRef } from "react";

export function useStoryMedia() {
    const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string>("");
    const [selectedBgIndex, setSelectedBgIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type.startsWith("image/") && file.size > 10 * 1024 * 1024) {
            alert("Ảnh không được vượt quá 10MB.");
            return;
        }
        if (file.type.startsWith("video/") && file.size > 100 * 1024 * 1024) {
            alert("Video không được vượt quá 100MB.");
            return;
        }
        setSelectedMedia(file);
        setMediaPreviewUrl(URL.createObjectURL(file));
        e.target.value = "";
    };

    const handleRemoveMedia = () => {
        if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
        setSelectedMedia(null);
        setMediaPreviewUrl("");
    };

    return {
        selectedMedia,
        mediaPreviewUrl,
        selectedBgIndex,
        fileInputRef,
        handleMediaSelect,
        handleRemoveMedia,
        setSelectedBgIndex,
    };
}
