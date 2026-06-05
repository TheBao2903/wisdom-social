import axiosClient from '../api/axiosClient';
import type { MusicTrack, PaginatedResponse } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const musicService = {
  async getAllMusic(page = 0, size = 20): Promise<PaginatedResponse<MusicTrack>> {
    const res = await axiosClient.get('/music', { params: { page, size } });
    const data = unwrap<any>(res);
    if (data?.content) return data as PaginatedResponse<MusicTrack>;
    const list = Array.isArray(data) ? data : [];
    return { content: list, totalElements: list.length, totalPages: 1, number: 0, size: list.length };
  },

  async searchByTitle(title: string): Promise<MusicTrack[]> {
    const res = await axiosClient.get('/music/search/title', { params: { title } });
    const data = unwrap<MusicTrack[]>(res);
    return Array.isArray(data) ? data : [];
  },

  async searchByArtist(artist: string): Promise<MusicTrack[]> {
    const res = await axiosClient.get('/music/search/artist', { params: { artist } });
    const data = unwrap<MusicTrack[]>(res);
    return Array.isArray(data) ? data : [];
  },
};

export default musicService;
