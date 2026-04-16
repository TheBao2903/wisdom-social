import axiosClient from "../api/axiosClient";
import type { User } from '../types';

export interface FriendRequest {
    senderId: number;
    receivedId: number;
}

// Friend Service
export const friendService = {
    // Get all friends for a user
    async getFriends(userId: string | number): Promise<User[]> {
        // Add timestamp to prevent browser caching
        const response = await axiosClient.get(`friends/${userId}`, {
            params: { _t: Date.now() }
        });
        return response.data.data;
    },

    // Get pending friend requests for a user (received)
    async getFriendRequests(userId: string | number): Promise<User[]> {
        // Add timestamp to prevent browser caching
        const response = await axiosClient.get(`friends/requests/${userId}`, {
            params: { _t: Date.now() }
        });
        return response.data.data;
    },

    // Get sent friend requests for a user
    async getSentRequests(userId: string | number): Promise<User[]> {
        const response = await axiosClient.get(`friends/sent-requests/${userId}`, {
            params: { _t: Date.now() }
        });
        return response.data.data;
    },

    // Send friend request
    async sendFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/request`, data);
        return response.data.data;
    },

    // Accept friend request
    async acceptFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/accept`, data);
        return response.data.data;
    },

    // Cancel friend request / Unfriend
    async cancelFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/cancel`, data);
        return response.data.data;
    },

    // Reject friend request
    async rejectFriendRequest(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`friends/reject`, data);
        return response.data.data;
    },

    // Block user
    async blockUser(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`auth/users/block`, data);
        return response.data.data;
    },

    // Unblock user
    async unblockUser(data: FriendRequest): Promise<string> {
        const response = await axiosClient.post(`auth/users/cancel-block`, data);
        return response.data.data;
    },

    // Get blocked users
    async getBlockedUsers(userId: string | number): Promise<User[]> {
        const response = await axiosClient.get(`auth/users/blocked/${userId}`);
        return response.data.data;
    },
};

export default friendService;
