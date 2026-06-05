import axiosClient from '../api/axiosClient';
import type { Page, PageMember, Post } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const pageService = {
  async getAllPages(): Promise<Page[]> {
    const res = await axiosClient.get('/page/all');
    const list = unwrap<Page[]>(res);
    return Array.isArray(list) ? list : [];
  },

  async getPageById(id: number): Promise<Page> {
    const res = await axiosClient.get(`/page/${id}`);
    return unwrap<Page>(res);
  },

  async deletePage(id: number): Promise<string> {
    const res = await axiosClient.delete(`/page/delete/${id}`);
    return unwrap<string>(res);
  },

  async getPageMembers(pageId: number): Promise<PageMember[]> {
    const res = await axiosClient.get(`/page-member/list/${pageId}`);
    return unwrap<PageMember[]>(res) ?? [];
  },

  async getMemberCount(pageId: number): Promise<number> {
    const res = await axiosClient.get(`/page-member/member-count/${pageId}`);
    return unwrap<number>(res) ?? 0;
  },

  async getPendingJoinRequests(pageId: number): Promise<PageMember[]> {
    const res = await axiosClient.get(`/page-member/pending-requests/${pageId}`);
    return unwrap<PageMember[]>(res) ?? [];
  },

  async approveMember(pageId: number, userId: number): Promise<string> {
    const res = await axiosClient.post('/page-member/approve-join', { pageId, userId });
    return unwrap<string>(res);
  },

  async rejectMember(pageId: number, userId: number): Promise<string> {
    const res = await axiosClient.post('/page-member/reject-join', { pageId, userId });
    return unwrap<string>(res);
  },

  async blockMember(pageId: number, userId: number): Promise<string> {
    const res = await axiosClient.post('/page-member/block', { pageId, userId });
    return unwrap<string>(res);
  },

  async unblockMember(pageId: number, userId: number): Promise<string> {
    const res = await axiosClient.post('/page-member/cancel-block', { pageId, userId });
    return unwrap<string>(res);
  },

  async removeMember(pageId: number, userId: number): Promise<string> {
    const res = await axiosClient.post('/page-member/delete', { pageId, userId });
    return unwrap<string>(res);
  },

  async authorizeMember(userId: number, pageId: number, role: string): Promise<string> {
    const res = await axiosClient.post('/page-member/authorize', { userId, pageId, role });
    return unwrap<string>(res);
  },

  async getPagePosts(pageId: number): Promise<Post[]> {
    const res = await axiosClient.get(`/page/post/all/${pageId}`);
    return unwrap<Post[]>(res) ?? [];
  },

  async getWaitingPosts(pageId: number): Promise<Post[]> {
    const res = await axiosClient.get(`/page/post/waiting-approve/${pageId}`);
    return unwrap<Post[]>(res) ?? [];
  },

  async approvePost(userId: number, pageId: number, postId: string): Promise<string> {
    const res = await axiosClient.post('/page/post/approve', { userId, pageId, postId });
    return unwrap<string>(res);
  },

  async removePost(userId: number, pageId: number, postId: string): Promise<string> {
    const res = await axiosClient.post('/page/post/remove', { userId, pageId, postId });
    return unwrap<string>(res);
  },
};

export default pageService;
