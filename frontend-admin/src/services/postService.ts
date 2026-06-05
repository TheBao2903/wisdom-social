import axiosClient from '../api/axiosClient';
import type { Post, PaginatedResponse } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const postService = {
  async getPostsByUser(userId: number, page = 0, size = 20): Promise<PaginatedResponse<Post>> {
    const res = await axiosClient.get(`/posts/user/${userId}`, { params: { page, size } });
    const data = unwrap<any>(res);
    if (data?.content) return data as PaginatedResponse<Post>;
    const list = Array.isArray(data) ? data : [];
    return {
      content: list,
      totalElements: list.length,
      totalPages: 1,
      number: 0,
      size: list.length,
    };
  },

  async getPostById(id: string): Promise<Post> {
    const res = await axiosClient.get(`/posts/${id}`);
    return unwrap<Post>(res);
  },

  async deletePost(id: string): Promise<void> {
    await axiosClient.delete(`/posts/${id}`);
  },

  async getPostCountForUser(userId: number): Promise<number> {
    const res = await axiosClient.get(`/posts/user/${userId}/count`);
    return unwrap<number>(res) ?? 0;
  },
};

export default postService;
