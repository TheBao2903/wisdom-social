import axiosClient from "../api/axiosClient";
import type { User } from '../types';
import { buildS3Url } from "../utils/s3";

export interface FriendRequest {
    senderId: number;
    receivedId: number;
}

export const friendService = {
    // Get all friends for a user
    async getFriends(userId: string | number): Promise<any[]> {
        try {
            // Add timestamp to prevent browser caching
            const response = await axiosClient.get(`friends/${userId}`, {
                params: { _t: Date.now() }
            });

            const rawData = response.data.data || response.data || [];

            // Map friends data to expected format for frontend components
            return rawData.map((friend: any) => {
                const rawAvatar =
                    friend.avatarUrl ||
                    friend.avatar ||
                    friend.imageUrl ||
                    friend.profilePicture ||
                    "";
                const avatarUrl =
                    buildS3Url(rawAvatar) ||
                    rawAvatar ||
                    "https://i.pravatar.cc/150?img=5";

                return {
                    id: Number(friend.userId ?? friend.id),
                    username: friend.username,
                    fullName: friend.fullName || friend.name || friend.username,
                    name: friend.name || friend.fullName || friend.username,
                    avatarUrl,
                    avatar: avatarUrl,
                };
            });
        } catch (error) {
            console.error(`Error fetching friends for user ${userId}:`, error);
            return [];
        }
    },

    // Alias for getFriends to support legacy code/consistency
    async fetchFriends(userId: string | number): Promise<any[]> {
        return this.getFriends(userId);
    },

    async getFriendRequests(userId: string | number): Promise<User[]> {
        const response = await axiosClient.get(`friends/requests/${userId}`, {
            params: { _t: Date.now() }
        });
        return response.data.data;
    },

    async getSentRequests(userId: string | number): Promise<User[]> {
        const response = await axiosClient.get(`friends/sent-requests/${userId}`, {
            params: { _t: Date.now() }
        });
        return response.data.data;
    },

    async sendFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/request`, data);
        return response.data.data;
    },

    async acceptFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/accept`, data);
        return response.data.data;
    },

    async cancelFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/cancel`, data);
        return response.data.data;
    },

    async rejectFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/reject`, data);
        return response.data.data;
    },

    async getFriendSuggestions(userId: number, limit = 20): Promise<User[]> {
        try {
            const response = await axiosClient.get(`friends/suggestions/${userId}`, {
                params: { limit, _t: Date.now() },
            });
            const data = response.data?.data ?? [];
            if (!Array.isArray(data)) return [];
            return data.map((s: any) => {
                const rawAvatar =
                    s.avatarUrl || s.avatar || s.imageUrl || s.profilePicture || "";
                const avatarUrl =
                    buildS3Url(rawAvatar) ||
                    rawAvatar ||
                    "https://i.pravatar.cc/150";
                return {
                    id: Number(s.userId ?? s.id),
                    username: s.username,
                    fullName: s.fullName || s.name || s.username,
                    name: s.name || s.fullName || s.username,
                    avatarUrl,
                    bio: s.bio,
                    mutualFriendsCount: s.mutualFriendsCount,
                } as User & { mutualFriendsCount?: number };
            });
        } catch (err) {
            console.error(`Error fetching friend suggestions for ${userId}:`, err);
            return [];
        }
    },
};

export default friendService;
