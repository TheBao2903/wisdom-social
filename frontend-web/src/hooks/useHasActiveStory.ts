import { useState, useEffect, useCallback } from "react";
import axiosClient from "../api/axiosClient";

/**
 * Hook to check if a given user has at least one active (non-expired) story.
 * Also checks if the user has unviewed active stories.
 * Uses the optimized /api/stories/user/{userId}/has-active endpoint.
 * Used to display the gradient story ring around avatars.
 */
export function useHasActiveStory(userId: string | number | null | undefined) {
    const [hasStory, setHasStory] = useState(false);
    const [hasUnviewed, setHasUnviewed] = useState(false);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!userId) {
            setHasStory(false);
            setHasUnviewed(false);
            return;
        }
        setLoading(true);
        try {
            const response = await axiosClient.get(
                `/stories/user/${userId}/has-active`
            );
            const data = response.data?.data || response.data;
            const hasActive = data?.hasActiveStory === true;
            const hasUnviewedActive = data?.hasUnviewedStory === true;
            
            setHasStory(hasActive);
            setHasUnviewed(hasUnviewedActive);
        } catch {
            // Silently fail — don't block the UI for a decorative feature
            setHasStory(false);
            setHasUnviewed(false);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { hasStory, hasUnviewed, loading, refresh };
}
