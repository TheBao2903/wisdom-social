import { useEffect, useState, useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Music2,
  RefreshCw,
} from 'lucide-react';
import musicService from '../services/musicService';
import type { MusicTrack, PaginatedResponse } from '../types/models';
import { buildS3Url } from '../utils/s3';
import { audioPlayer } from '../utils/audioPlayer';

const PAGE_SIZE = 20;

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Music() {
  const [data, setData] = useState<PaginatedResponse<MusicTrack>>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'title' | 'artist'>('title');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MusicTrack[] | null>(null);
  // Trạng thái phát được giữ ở singleton -> không mất khi chuyển trang rồi quay lại
  const playingId = useSyncExternalStore(audioPlayer.subscribe, audioPlayer.getPlayingId);

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      const res = await musicService.getAllMusic(p, PAGE_SIZE);
      setData(res);
      setPage(p);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tải được thư viện nhạc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0);
  }, []);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results =
        searchMode === 'title'
          ? await musicService.searchByTitle(q)
          : await musicService.searchByArtist(q);
      setSearchResults(results);
    } catch {
      toast.error('Tìm kiếm thất bại');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const togglePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioPlayer.toggle(track.id, '');
      return;
    }
    const src = buildS3Url(track.audioUrl);
    if (!src) {
      toast.error('Không có URL phát nhạc');
      return;
    }
    audioPlayer.toggle(track.id, src, () => toast.error('Không thể phát nhạc'));
  };

  const tracks = searchResults ?? data.content;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Thư viện nhạc</h1>
          <p className="text-sm text-slate-500">
            {searchResults
              ? `${searchResults.length} kết quả tìm kiếm`
              : `Tổng: ${data.totalElements} bài nhạc`}
          </p>
        </div>
        <button
          onClick={() => { clearSearch(); loadPage(0); }}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchMode === 'title' ? 'Tìm theo tên bài...' : 'Tìm theo nghệ sĩ...'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['title', 'artist'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSearchMode(m)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  searchMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'title' ? 'Tên bài' : 'Nghệ sĩ'}
              </button>
            ))}
          </div>

          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>

          {searchResults && (
            <button
              onClick={clearSearch}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-28 px-4 py-3"></th>
                <th className="px-4 py-3 text-left">Bài nhạc</th>
                <th className="px-4 py-3 text-left">Nghệ sĩ</th>
                <th className="px-4 py-3 text-left">Thời lượng</th>
                <th className="px-4 py-3 text-left">Ngày thêm</th>
                <th className="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Đang tải...</td>
                </tr>
              ) : tracks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Không có bài nhạc nào.</td>
                </tr>
              ) : (
                tracks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {t.imageUrl ? (
                        <img src={buildS3Url(t.imageUrl) || ''} className="h-12 w-20 max-w-none shrink-0 rounded-lg object-cover" alt="" />
                      ) : (
                        <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-indigo-50">
                          <Music2 size={22} className="text-indigo-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{t.title}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.artist}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDuration(t.duration)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {t.audioUrl && (
                        <button
                          onClick={() => togglePlay(t)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                        >
                          {playingId === t.id ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!searchResults && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Trang {data.number + 1} / {data.totalPages} · {data.totalElements} bài
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => loadPage(page - 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                disabled={page >= data.totalPages - 1}
                onClick={() => loadPage(page + 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
