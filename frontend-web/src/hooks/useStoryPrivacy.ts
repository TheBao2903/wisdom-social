import { useState } from "react";

type StoryPrivacy =
    | "PUBLIC"
    | "FRIENDS"
    | "ONLY_ME"
    | "SPECIFIC"
    | "EXCEPT";

export function useStoryPrivacy() {
    const [privacy, setPrivacy] = useState<StoryPrivacy>("PUBLIC");
    const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
    const [specificViewers, setSpecificViewers] = useState<string[]>([]);
    const [excludedUsers, setExcludedUsers] = useState<string[]>([]);
    const [showSpecificModal, setShowSpecificModal] = useState(false);
    const [showExcludedModal, setShowExcludedModal] = useState(false);

    return {
        privacy,
        setPrivacy,
        showPrivacyMenu,
        setShowPrivacyMenu,
        specificViewers,
        setSpecificViewers,
        excludedUsers,
        setExcludedUsers,
        showSpecificModal,
        setShowSpecificModal,
        showExcludedModal,
        setShowExcludedModal,
    };
}
