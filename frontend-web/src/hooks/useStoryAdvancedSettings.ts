import { useState } from "react";

export function useStoryAdvancedSettings() {
    const [showSidebar, setShowSidebar] = useState(true);
    const [showMusicPicker, setShowMusicPicker] = useState(false);

    return {
        showSidebar,
        setShowSidebar,
        showMusicPicker,
        setShowMusicPicker,
    };
}
