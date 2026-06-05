import axiosClient from '../api/axiosClient';
import type { TrendingHashtag } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const hashtagService = {
  async getTrending(): Promise<TrendingHashtag[]> {
    try {
      const res = await axiosClient.get('/hashtags/trending');
      const data = unwrap<any>(res);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
};

export default hashtagService;
