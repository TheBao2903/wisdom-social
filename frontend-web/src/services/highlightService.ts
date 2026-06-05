/**
 * Story Highlight Service
 * Handles all API calls for story highlight operations
 */

import axiosClient from "../api/axiosClient";

export interface HighlightStory {
  id: string;
  userId: string;
  media?: {
    url: string;
    type: string;
    thumbnailUrl?: string;
  };
  text?: string;
  createdAt: string;
  isArchived: boolean;
  highlightCategory?: string;
}

export interface StoryHighlight {
  id: string;
  userId: string;
  title: string;
  coverImageUrl?: string;
  stories: HighlightStory[];
  displayOrder: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all highlights for a user
 */
export const getUserHighlights = async (userId: string): Promise<StoryHighlight[]> => {
  try {
    const response = await axiosClient.get(`/stories/highlights/user/${userId}`);
    return response.data?.data ?? response.data ?? [];
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
    const response = await axiosClient.post("/stories/highlights", {
      title,
      storyIds,
      coverImageUrl,
    });
    return response.data?.data ?? response.data;
  } catch (error: any) {
    console.error("Error creating highlight:", error);
    throw new Error("Failed to create highlight: " + (error?.message || "Unknown error"));
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
    const response = await axiosClient.put(`/stories/highlights/${highlightId}`, data);
    return response.data?.data ?? response.data;
  } catch (error: any) {
    console.error("Error updating highlight:", error);
    throw new Error("Failed to update highlight");
  }
};

/**
 * Delete a highlight
 */
export const deleteHighlight = async (highlightId: string): Promise<void> => {
  try {
    await axiosClient.delete(`/stories/highlights/${highlightId}`);
  } catch (error: any) {
    console.error("Error deleting highlight:", error);
    throw new Error("Failed to delete highlight");
  }
};

/**
 * Get all stories for a user (for highlight selection modal)
 */
export const getAllUserStories = async (userId: string): Promise<HighlightStory[]> => {
  try {
    const response = await axiosClient.get(`/stories/user/${userId}/all`);
    return response.data?.data ?? response.data ?? [];
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
    const response = await axiosClient.delete(
      `/stories/highlights/${highlightId}/stories`,
      {
        params: {
          storyIds: storyIds.join(","),
        },
      }
    );
    return response.data?.data ?? response.data;
  } catch (error: any) {
    console.error("Error removing stories from highlight:", error);
    throw new Error("Failed to remove stories from highlight");
  }
};
