import axiosClient from '../api/axiosClient';
import type { Story } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const storyService = {
  async getAllStories(): Promise<Story[]> {
    const res = await axiosClient.get('/stories/debug/all-stories');
    const data = unwrap<Story[]>(res);
    return Array.isArray(data) ? data : [];
  },

  async getStoriesByUser(userId: number): Promise<Story[]> {
    const res = await axiosClient.get(`/stories/user/${userId}`);
    const data = unwrap<Story[]>(res);
    return Array.isArray(data) ? data : [];
  },

  async deleteStory(storyId: string): Promise<void> {
    await axiosClient.delete(`/admin/stories/${storyId}`);
  },
};

export default storyService;
