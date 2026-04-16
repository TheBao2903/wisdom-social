import axiosClient from "../api/axiosClient";
import type { User } from '../types';

export interface UserRequestCreatePage {
    name: string;
    username: string;
    category: string;
    description?: string;
    avatarUrl?: string;
    coverUrl?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    isVerified?: boolean;
    status?: "PUBLIC" | "PRIVATE";
}

export interface UserRequestUpdatePage {
    name?: string;
    username?: string;
    category?: string;
    description?: string;
    avatarUrl?: string;
    coverUrl?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    isVerified?: boolean;
    status?: "PUBLIC" | "PRIVATE";
}

export interface UserRequestPage {
    userId: number;
    pageId: number;
}

export interface UserRequestMemberPage {
    userId: number;
    pageId: number;
    pageRole: string;
}

export interface UserRequestAuthorizePage {
    userId: number;
    pageId: number;
    pageRole: string;
}

export interface UserRequestPagePost {
    userId: number;
    pageId: number;
    postId: string;
}

export interface PageJoinRequest {
    userId: number;
    pageId: number;
}

export interface Page {
    id: number;
    userId?: number;  // May not be returned directly
    createdBy?: {     // Backend returns User object
        id: number;
        username?: string;
        name?: string;
    };
    name: string;
    username: string;
    category: string;
    description?: string;
    avatarUrl?: string;
    coverUrl?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    isVerified?: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface PageMember {
    id: number;
    pageId: number;
    userId: number;
    pageRole: string;
    memberStatus: string;
    joinDate: string;
}

export interface PagePost {
    id: string;
    pageId: number;
    postId: string;
    status: string;
    createdAt: string;
}

// Page Service
export const pageService = {
    // ========== PAGE MANAGEMENT ==========

    // Create a new page
    async createPage(data: UserRequestCreatePage): Promise<string> {
        const response = await axiosClient.post(`page/create`, data);
        return response.data.data;
    },

    // Update page
    async updatePage(pageId: number, data: UserRequestUpdatePage): Promise<boolean> {
        const response = await axiosClient.post(`page/update/${pageId}`, data);
        return response.data.data;
    },

    // Delete page
    async deletePage(pageId: number): Promise<boolean> {
        const response = await axiosClient.delete(`page/delete/${pageId}`);
        return response.data.data;
    },

    // Get page by ID
    async getPageById(pageId: number): Promise<Page> {
        const response = await axiosClient.get(`page/${pageId}`);
        return response.data.data;
    },

    // Get all pages
    async getAllPages(): Promise<Page[]> {
        const response = await axiosClient.get(`page/all`);
        return response.data.data;
    },

    // Get my pages
    async getMyPages(): Promise<Page[]> {
        const response = await axiosClient.get(`page/my-pages`);
        return response.data.data;
    },

    // ========== PAGE INTERACTION ==========

    // Like page
    async likePage(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page/like`, { userId, pageId });
        return response.data.data;
    },

    // Follow page
    async followPage(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page/follow`, { userId, pageId });
        return response.data.data;
    },

    // Cancel like page
    async cancelLikePage(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page/cancel-like`, { userId, pageId });
        return response.data.data;
    },

    // Cancel follow page
    async cancelFollowPage(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page/cancel-follow`, { userId, pageId });
        return response.data.data;
    },

    // Get page interaction status
    async getPageInteractionStatus(pageId: number): Promise<Record<string, any>> {
        const response = await axiosClient.get(`page/${pageId}/interaction-status`);
        return response.data.data;
    },

    // ========== PAGE IMAGE UPLOAD ==========

    // Get upload URL for avatar (backend returns string directly, not wrapped)
    async getUploadAvatarUrl(type: string, pageId: number, extension: string): Promise<string> {
        const response = await axiosClient.get(`page/update/upload-avatar`, {
            params: { type, id: pageId, extension }
        });
        return response.data; // Backend returns String directly (not wrapped in ApiResponse)
    },

    // Get upload URL for cover (backend returns string directly, not wrapped)
    async getUploadCoverUrl(type: string, pageId: number, extension: string): Promise<string> {
        const response = await axiosClient.get(`page/update/upload-cover`, {
            params: { type, id: pageId, extension }
        });
        return response.data; // Backend returns String directly (not wrapped in ApiResponse)
    },

    // Generate upload URL for new image
    async generateUploadUrl(type: string, extension: string): Promise<{
        imageUrl: string;
        uploadUrl: string;
        uuid: string;
    }> {
        const response = await axiosClient.get(`page/upload-avatar`, {
            params: { type, extension }
        });
        return response.data.data;
    },

    // ========== PAGE POSTS ==========

    // Approve post on page
    async approvePost(userId: number, pageId: number, postId: string): Promise<string> {
        const response = await axiosClient.post(`page/post/approve`, {
            userId,
            pageId,
            postId
        });
        return response.data.data;
    },

    // Cancel approve post
    async cancelApprovePost(userId: number, pageId: number, postId: string): Promise<string> {
        const response = await axiosClient.post(`page/post/cancel-approve`, {
            userId,
            pageId,
            postId
        });
        return response.data.data;
    },

    // Add post to page
    async addPostToPage(pageId: number, postData: any, images?: string[]): Promise<string> {
        const formData = new FormData();
        formData.append('pageId', String(pageId));
        formData.append('postData', JSON.stringify(postData));
        if (images) {
            images.forEach(image => {
                formData.append('images', image);
            });
        }
        const response = await axiosClient.post(`page/post/add`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data;
    },

    // Get page post by ID
    async getPagePostById(postId: string, pageId: number): Promise<PagePost> {
        const response = await axiosClient.get(`page/post/${postId}/${pageId}`);
        return response.data.data;
    },

    // Remove post from page
    async removePostFromPage(userId: number, pageId: number, postId: string): Promise<string> {
        const response = await axiosClient.post(`page/post/remove`, {
            userId,
            pageId,
            postId
        });
        return response.data.data;
    },

    // Get all posts of page
    async getAllPostsOfPage(pageId: number): Promise<any[]> {
        const response = await axiosClient.get(`page/post/all/${pageId}`);
        return response.data.data;
    },

    // Get posts waiting for approval
    async getPostsWaitingForApproval(pageId: number): Promise<any[]> {
        const response = await axiosClient.get(`page/post/waiting-approve/${pageId}`);
        return response.data.data;
    },

    // Approve all posts
    async approveAllPosts(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page/post/approve-all`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Cancel all posts
    async cancelAllPosts(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page/post/cancel-all`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // ========== PAGE MEMBERS ==========

    // Add member to page
    async addMember(userId: number, pageId: number, pageRole: string): Promise<string> {
        const response = await axiosClient.post(`page-member/add`, {
            userId,
            pageId,
            pageRole
        });
        return response.data.data;
    },

    // Delete member from page
    async deleteMember(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/delete`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Block member
    async blockMember(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/block`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Cancel block member
    async unblockMember(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/cancel-block`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Authorize member (change role)
    async authorizeMember(userId: number, pageId: number, pageRole: string): Promise<string> {
        const response = await axiosClient.post(`page-member/authorize`, {
            userId,
            pageId,
            pageRole
        });
        return response.data.data;
    },

    // Get page members
    async getPageMembers(pageId: number): Promise<PageMember[]> {
        const response = await axiosClient.get(`page-member/list/${pageId}`);
        return response.data.data;
    },

    // ========== PAGE JOIN REQUESTS ==========

    // Request to join page
    async requestJoinPage(userId: number, pageId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/request-join`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Approve join request
    async approveJoinRequest(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/approve-join`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Reject join request
    async rejectJoinRequest(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/reject-join`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Cancel join request
    async cancelJoinRequest(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.post(`page-member/cancel-join`, {
            userId,
            pageId
        });
        return response.data.data;
    },

    // Get pending join requests
    async getPendingJoinRequests(pageId: number): Promise<PageMember[]> {
        const response = await axiosClient.get(`page-member/pending-requests/${pageId}`);
        return response.data.data;
    },

    // Get member status
    async getMemberStatus(pageId: number, userId: number): Promise<string> {
        const response = await axiosClient.get(`page-member/member-status/${pageId}/${userId}`);
        return response.data.data;
    },

    // Get member count
    async getMemberCount(pageId: number): Promise<number> {
        const response = await axiosClient.get(`page-member/member-count/${pageId}`);
        return response.data.data;
    },
};

export default pageService;
