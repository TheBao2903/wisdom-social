import apiClient from "@/api/apiClient";

export type PageStatus = "PUBLIC" | "PRIVATE" | "BANNED";

export type MemberStatus = "PENDING" | "ACTIVE" | "REMOVED" | "REJECTED";

export type PageRole = "ADMIN" | "MODERATOR" | "USER";

export type CreatePageRequest = {
  name: string;
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
  status?: PageStatus;
};

export type UpdatePageRequest = {
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
  status?: PageStatus;
};

export type PageData = {
  id: number;
  name: string;
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
  status?: PageStatus;
  createdBy?: {
    id: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
    phone?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  // Per-current-user interaction state, embedded by the backend on the
  // discover list (/page/all) so the list can render like/follow in one call.
  isLiked?: boolean;
  isFollowing?: boolean;
  likeCount?: number;
  followCount?: number;
};

export type PageMemberData = {
  id?: number;
  pageId?: number;
  user: {
    id: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
    phone?: string;
  };
  role: PageRole;
  status: MemberStatus;
  joinedAt?: string;
};

export type PageInteractionStatus = {
  isLiked: boolean;
  isFollowing: boolean;
  likeCount: number;
  followCount: number;
};

class PageService {


  // ── Page CRUD ──────────────────────────────────────────────────────────

  async getAllPages(): Promise<PageData[]> {
    try {
      const response = await apiClient.get("/page/all");
      const data = response.data?.data ?? response.data;
      if (Array.isArray(data) && data.length > 0) return data;
      return [];
    } catch {
      return [];
    }
  }

  async getMyPages(): Promise<PageData[]> {
    try {
      const response = await apiClient.get("/page/my-pages");
      const data = response.data?.data ?? response.data;
      if (Array.isArray(data) && data.length > 0) return data;
      return [];
    } catch {
      return [];
    }
  }

  async createPage(data: CreatePageRequest): Promise<string> {
    try {
      const response = await apiClient.post("/page/create", data);
      return response.data?.data ?? "";
    } catch {
      const id = Date.now();
      const localPage: PageData = {
        id,
        name: data.name,
        username: data.username,
        category: data.category,
        description: data.description,
        status: data.status ?? "PUBLIC",
        createdBy: { id: 0, name: "Local User" },
      };
    
      return "local-created";
    }
  }

  async updatePage(pageId: number, data: UpdatePageRequest): Promise<boolean> {
    try {
      const response = await apiClient.post(`/page/update/${pageId}`, data);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async deletePage(pageId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/page/delete/${pageId}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async findPageById(pageId: number): Promise<PageData | null> {
    try {
      const response = await apiClient.get(`/page/${pageId}`);
      return response.data?.data ?? null;
    } catch {
      return null;
    }
  }

  // ── Like / Follow ──────────────────────────────────────────────────────

  async likePage(userId: number, pageId: number): Promise<string> {
    try {
      const response = await apiClient.post("/page/like", { userId, pageId });
      return response.data?.data ?? "";
    } catch {
      
      return "local-liked";
    }
  }

  async followPage(userId: number, pageId: number): Promise<string> {
    try {
      const response = await apiClient.post("/page/follow", { userId, pageId });
      return response.data?.data ?? "";
    } catch {
      
      return "local-followed";
    }
  }

  async cancelLikePage(userId: number, pageId: number): Promise<string> {
    try {
      const response = await apiClient.post("/page/cancel-like", {
        userId,
        pageId,
      });
      return response.data?.data ?? "";
    } catch {
      
      return "local-unliked";
    }
  }

  async cancelFollowPage(userId: number, pageId: number): Promise<string> {
    try {
      const response = await apiClient.post("/page/cancel-follow", {
        userId,
        pageId,
      });
      return response.data?.data ?? "";
    } catch {
      
      return "local-unfollowed";
    }
  }

  async getPageInteractionStatus(
    pageId: number,
  ): Promise<PageInteractionStatus> {
    try {
      const response = await apiClient.get(
        `/page/${pageId}/interaction-status`,
      );
      const d = response.data?.data ?? response.data;
      return {
        isLiked: !!d?.isLiked,
        isFollowing: !!d?.isFollowing,
        likeCount: Number(d?.likeCount) || 0,
        followCount: Number(d?.followCount) || 0,
      };
    } catch {
      return {} as PageInteractionStatus;
    }
  }

  // ── Member management ──────────────────────────────────────────────────

  async getPageMembers(pageId: number): Promise<PageMemberData[]> {
    try {
      const response = await apiClient.get(`/page-member/list/${pageId}`);
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getMemberStatus(
    pageId: number,
    userId: number,
  ): Promise<MemberStatus | null> {
    try {
      const response = await apiClient.get(
        `/page-member/member-status/${pageId}/${userId}`,
      );
      return response.data?.data ?? response.data ?? null;
    } catch {
      return null;
    }
  }

  async getMemberCount(pageId: number): Promise<number> {
    try {
      const response = await apiClient.get(
        `/page-member/member-count/${pageId}`,
      );
      return Number(response.data?.data ?? response.data) || 0;
    } catch {
      return 0;
    }
  }

  async addMember(
    userId: number,
    pageId: number,
    role: PageRole = "USER",
  ): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/add", {
        userId,
        pageId,
        pageRole: role,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async removeMember(pageId: number, userId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/delete", {
        pageId,
        userId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async blockMember(pageId: number, userId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/block", {
        pageId,
        userId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async unblockMember(pageId: number, userId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/cancel-block", {
        pageId,
        userId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async authorizeMember(
    userId: number,
    pageId: number,
    role: PageRole,
  ): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/authorize", {
        userId,
        pageId,
        pageRole: role,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // ── Join requests ──────────────────────────────────────────────────────

  async requestJoinPage(
    userId: number,
    pageId: number,
    message?: string,
  ): Promise<string> {
    try {
      const response = await apiClient.post("/page-member/request-join", {
        userId,
        pageId,
        message,
      });
      return response.data?.data ?? "";
    } catch {
      return "local-requested";
    }
  }

  async cancelJoinRequest(pageId: number, userId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/cancel-join", {
        pageId,
        userId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getPendingJoinRequests(pageId: number): Promise<PageMemberData[]> {
    try {
      const response = await apiClient.get(
        `/page-member/pending-requests/${pageId}`,
      );
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async approveJoinRequest(pageId: number, userId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/approve-join", {
        pageId,
        userId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async rejectJoinRequest(pageId: number, userId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page-member/reject-join", {
        pageId,
        userId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────

  async getUploadUrl(
    type: string,
    extension: string,
  ): Promise<{ uploadUrl: string; uuid: string; extension: string } | null> {
    try {
      const response = await apiClient.get("/page/upload-avatar", {
        params: { type, extension },
      });
      const data = response.data?.data ?? response.data;
      return {
        uploadUrl: data.uploadUrl ?? "",
        uuid: data.uuid ?? "",
        extension: data.extension ?? extension,
      };
    } catch {
      return null;
    }
  }

  async getUploadAvatarUrl(
    type: string,
    pageId: number,
    extension: string,
  ): Promise<string> {
    try {
      if (!pageId || !Number.isFinite(pageId) || pageId <= 0)
        throw new Error("Invalid pageId for avatar upload");
      const response = await apiClient.get("/page/update/upload-avatar", {
        params: { type, id: pageId, extension },
      });
      return response.data; // Backend returns String directly (not wrapped in ApiResponse)
    } catch {
      return "";
    }
  }

  async getUploadCoverUrl(
    type: string,
    pageId: number,
    extension: string,
  ): Promise<string> {
    try {
      if (!pageId || !Number.isFinite(pageId) || pageId <= 0)
        throw new Error("Invalid pageId for cover upload");
      const response = await apiClient.get("/page/update/upload-cover", {
        params: { type, id: pageId, extension },
      });
      return response.data; // Backend returns String directly (not wrapped in ApiResponse)
    } catch {
      return "";
    }
  }

  // ── Post management ────────────────────────────────────────────────────

  async getPostsWaitingForApproval(pageId: number): Promise<PagePostItem[]> {
    try {
      const response = await apiClient.get(
        `/page/post/waiting-approve/${pageId}`,
      );
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getMyPendingPosts(pageId: number): Promise<PagePostItem[]> {
    try {
      const response = await apiClient.get(
        `/page/post/my-pending/${pageId}`,
      );
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async approvePost(
    userId: number,
    pageId: number,
    postId: string,
  ): Promise<boolean> {
    try {
      const response = await apiClient.post("/page/post/approve", {
        userId,
        pageId,
        postId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async cancelApprovePost(
    userId: number,
    pageId: number,
    postId: string,
  ): Promise<boolean> {
    try {
      const response = await apiClient.post("/page/post/cancel-approve", {
        userId,
        pageId,
        postId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async removePostFromPage(
    userId: number,
    pageId: number,
    postId: string,
  ): Promise<boolean> {
    try {
      const response = await apiClient.post("/page/post/remove", {
        userId,
        pageId,
        postId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getAllPostsOfPage(pageId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`/page/post/all/${pageId}`);
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async addPostToPage(
    pageId: number,
    postData: {
      content: string;
      privacy?: string;
      allowComments?: boolean;
      allowShares?: boolean;
    },
    images?: { uri: string; name: string; type: string }[],
  ): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append(
        "postData",
        JSON.stringify({
          privacy: "PUBLIC",
          allowComments: true,
          allowShares: true,
          ...postData,
        }),
      );
      if (images?.length) {
        images.forEach((img) => formData.append("images", img as any));
      }
      const response = await apiClient.post("/page/post/add", formData, {
        params: { pageId },
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async approveAllPosts(userId: number, pageId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page/post/approve-all", {
        userId,
        pageId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async cancelAllPosts(userId: number, pageId: number): Promise<boolean> {
    try {
      const response = await apiClient.post("/page/post/cancel-all", {
        userId,
        pageId,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export type PagePostItem = {
  id: string;
  content?: string;
  caption?: string;
  images?: string[];
  createdAt?: string;
  user?: {
    id?: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
};

export default new PageService();
