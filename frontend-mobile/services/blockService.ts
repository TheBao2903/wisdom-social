import apiClient from "@/api/apiClient";
import { mockFeatureBlocked } from "@/constants";

type BlockedUser = {
    id: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
    phone?: string;
};

class BlockService {
    private localBlocked: BlockedUser[] = [...mockFeatureBlocked];

    async getBlockedUsers(userId: number): Promise<BlockedUser[]> {
        try {
            const response = await apiClient.get(`/auth/users/blocked/${userId}`);
            const data = response.data?.data ?? response.data;
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
            return this.localBlocked;
        } catch {
            return this.localBlocked;
        }
    }

    async blockUser(blockerId: number, blockedId: number): Promise<boolean> {
        try {
            await apiClient.post("/auth/users/block", {
                senderId: blockerId,
                receivedId: blockedId,
            });
            return true;
        } catch {
            if (!this.localBlocked.some((user) => user.id === blockedId)) {
                this.localBlocked = [
                    ...this.localBlocked,
                    {
                        id: blockedId,
                        name: `Blocked ${blockedId}`,
                        username: `blocked${blockedId}`,
                    },
                ];
            }
            return false;
        }
    }

    async unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
        try {
            await apiClient.post("/auth/users/cancel-block", {
                senderId: blockerId,
                receivedId: blockedId,
            });
            return true;
        } catch {
            this.localBlocked = this.localBlocked.filter(
                (user) => user.id !== blockedId,
            );
            return false;
        }
    }
}

export default new BlockService();
