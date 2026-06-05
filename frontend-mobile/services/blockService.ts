import apiClient from "@/api/apiClient";
import { emitFriendMutation } from "@/services/friendService";

export type BlockedUser = {
    id: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
    phone?: string;
};

class BlockService {
    async getBlockedUsers(userId: number): Promise<BlockedUser[]> {
        try {
            const response = await apiClient.get(`/auth/users/blocked/${userId}`);
            const data = response.data?.data ?? response.data;
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    async blockUser(blockerId: number, blockedId: number): Promise<boolean> {
        try {
            await apiClient.post("/auth/users/block", { senderId: blockerId, receivedId: blockedId });
            emitFriendMutation();
            return true;
        } catch {
            return false;
        }
    }

    async unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
        try {
            await apiClient.post("/auth/users/cancel-block", { senderId: blockerId, receivedId: blockedId });
            emitFriendMutation();
            return true;
        } catch {
            return false;
        }
    }
}

export default new BlockService();
