import axiosClient from "../api/axiosClient";
import type { User } from '../types';

class BlockService {
    async getBlockedUsers(userId: number): Promise<User[]> {
        try {
            const response = await axiosClient.get(`auth/users/blocked/${userId}`);
            const data = response.data?.data ?? response.data;
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    async blockUser(blockerId: number, blockedId: number): Promise<boolean> {
        try {
            await axiosClient.post("auth/users/block", { senderId: blockerId, receivedId: blockedId });
            return true;
        } catch {
            return false;
        }
    }

    async unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
        try {
            await axiosClient.post("auth/users/cancel-block", { senderId: blockerId, receivedId: blockedId });
            return true;
        } catch {
            return false;
        }
    }
}

export default new BlockService();
