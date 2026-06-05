import apiClient from "@/api/apiClient";
import { StoryHighlight, HighlightStory } from "@/types";

const unwrap = (payload: any) => payload?.data ?? payload;

/**
 * Get all highlights for a user
 */
export const getUserHighlights = async (userId: string): Promise<StoryHighlight[]> => {
    try {
        const response = await apiClient.get(`/stories/highlights/user/${userId}`);
        const unwrapped = unwrap(response.data);
        return Array.isArray(unwrapped) ? unwrapped : [];
    } catch (error: any) {
        console.error("Error fetching highlights:", error);
        return [];
    }
};

/**
 * Create a new highlight group
 */
export const createHighlight = async (
    title: string,
    storyIds: string[],
    coverImageUrl?: string
): Promise<StoryHighlight | null> => {
    try {
        const response = await apiClient.post("/stories/highlights", {
            title,
            storyIds,
            coverImageUrl,
        });
        return unwrap(response.data);
    } catch (error: any) {
        console.error("Error creating highlight:", error);
        throw new Error(error?.response?.data?.message || error?.message || "Failed to create highlight");
    }
};

/**
 * Update an existing highlight
 */
export const updateHighlight = async (
    highlightId: string,
    data: { title?: string; storyIds?: string[]; coverImageUrl?: string }
): Promise<StoryHighlight | null> => {
    try {
        const response = await apiClient.put(`/stories/highlights/${highlightId}`, data);
        return unwrap(response.data);
    } catch (error: any) {
        console.error("Error updating highlight:", error);
        throw new Error(error?.response?.data?.message || error?.message || "Failed to update highlight");
    }
};

/**
 * Delete a highlight
 */
export const deleteHighlight = async (highlightId: string): Promise<void> => {
    try {
        await apiClient.delete(`/stories/highlights/${highlightId}`);
    } catch (error: any) {
        console.error("Error deleting highlight:", error);
        throw new Error(error?.response?.data?.message || error?.message || "Failed to delete highlight");
    }
};

/**
 * Get all stories for a user (for highlight selection modal)
 */
export const getAllUserStories = async (userId: string): Promise<HighlightStory[]> => {
    try {
        const response = await apiClient.get(`/stories/user/${userId}/all`);
        const unwrapped = unwrap(response.data);
        return Array.isArray(unwrapped) ? unwrapped : [];
    } catch (error: any) {
        console.error("Error fetching all user stories:", error);
        return [];
    }
};

/**
 * Remove stories from a highlight group
 */
export const removeStoriesFromHighlight = async (
    highlightId: string,
    storyIds: string[]
): Promise<StoryHighlight | null> => {
    try {
        const response = await apiClient.delete(`/stories/highlights/${highlightId}/stories`, {
            params: {
                storyIds: storyIds.join(","),
            },
        });
        return unwrap(response.data);
    } catch (error: any) {
        console.error("Error removing stories from highlight:", error);
        throw new Error(error?.response?.data?.message || error?.message || "Failed to remove stories from highlight");
    }
};
