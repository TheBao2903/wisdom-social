import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Play, Pause, Bookmark, X } from "lucide-react";
import {
  getAllMusic,
  playAudioPreview,
  searchMusicByTitle,
  formatDuration,
  resolveMusicMediaUrl,
  stopAudioPreview,
  type MusicMetadata,
} from "../../../services/musicService";

interface MusicSelectorProps {
  onSelect: (music: MusicMetadata) => void;
  onClose?: () => void;
}

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

function CircularProgress({
  progress,
  size = 36,
  strokeWidth = 3.2,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference -
    (Math.min(Math.max(progress, 0), 100) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
      style={{ transform: "rotate(-90deg)" }}
      shapeRendering="geometricPrecision"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(29, 78, 216, 0.22)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#1d4ed8"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

interface MusicItemProps {
  music: MusicMetadata;
  isPlaying: boolean;
  isSaved: boolean;
  progress: number;
  onPlay: (music: MusicMetadata) => void;
  onSave: (id: string) => void;
  onSelect: (music: MusicMetadata) => void;
}

function MusicItem({
  music,
  isPlaying,
  isSaved,
  progress,
  onPlay,
  onSave,
  onSelect,
}: MusicItemProps) {
  const imageSrc = resolveMusicMediaUrl(music.imageUrl);
  const fallbackImage =
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=128&h=128&fit=crop";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <img
        src={imageSrc || fallbackImage}
        alt={music.title}
        className="w-14 h-14 rounded-lg object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate w-full">
          {music.title}
        </p>
        <p className="text-gray-400 text-xs mt-0.5 truncate">{music.artist}</p>
        <p className="text-gray-400 text-[11px] mt-0.5">
          {formatDuration(music.duration)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onSave(music.id)}
        className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
        title={isSaved ? "Unsave" : "Save"}
      >
        <Bookmark
          size={18}
          className={isSaved ? "fill-gray-700 text-gray-700" : ""}
        />
      </button>
      <button
        type="button"
        onClick={() => onPlay(music)}
        className="relative w-10 h-10 flex items-center justify-center shrink-0"
        title={isPlaying ? "Pause preview" : "Play preview"}
      >
        {isPlaying ? (
          <>
            <CircularProgress progress={progress} size={40} strokeWidth={3} />
            <span className="relative z-10 w-9 h-9 rounded-full bg-white flex items-center justify-center text-blue-700">
              <Pause size={14} fill="currentColor" />
            </span>
          </>
        ) : (
          <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200 transition-colors">
            <Play size={14} fill="currentColor" />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSelect(music)}
        className="px-2.5 py-1.5 text-xs font-medium rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
      >
        Chọn
      </button>
    </div>
  );
}

export default function MusicSelector({
  onSelect,
  onClose,
}: MusicSelectorProps) {
  const [musicList, setMusicList] = useState<MusicMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingProgress, setPlayingProgress] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return musicList;
    return musicList.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.artist.toLowerCase().includes(q)
    );
  }, [musicList, searchQuery]);

  // Load initial music list
  useEffect(() => {
    const loadInitialMusic = async () => {
      setLoading(true);
      const result = await getAllMusic(0, 20);
      setMusicList(result.tracks);
      setHasMore(result.hasMore);
      setPage(1);
      setLoading(false);
    };
    loadInitialMusic();
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setPage(0);
      const result = searchQuery.trim()
        ? await searchMusicByTitle(searchQuery, 0, 20)
        : await getAllMusic(0, 20);
      setMusicList(result.tracks);
      setHasMore(result.hasMore);
      setPage(1);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const result = searchQuery.trim()
      ? await searchMusicByTitle(searchQuery, page, 20)
      : await getAllMusic(page, 20);

    setMusicList((prev) => {
      const seen = new Set(prev.map((item) => item.id));
      const next = result.tracks.filter((item) => !seen.has(item.id));
      return [...prev, ...next];
    });
    setHasMore(result.hasMore);
    setPage((prev) => prev + 1);
    setLoadingMore(false);
  };

  // Toggle audio preview
  const togglePreview = (music: MusicMetadata) => {
    const audioUrl = resolveMusicMediaUrl(music.audioUrl);
    if (!audioUrl) return;

    if (playingId === music.id) {
      stopAudioPreview();
      setPlayingId(null);
      setPlayingProgress(0);
    } else {
      stopAudioPreview();
      const audio = playAudioPreview(audioUrl, {
        onLoadedMetadata: () => {
          setPlayingProgress(0);
        },
        onTimeUpdate: (audioEl) => {
          if (!audioEl.duration || Number.isNaN(audioEl.duration)) return;
          setPlayingProgress((audioEl.currentTime / audioEl.duration) * 100);
        },
        onEnded: () => {
          setPlayingId(null);
          setPlayingProgress(0);
        },
      });
      if (!audio) return;
      audioRef.current = audio;
      setPlayingId(music.id);
    }
  };

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      stopAudioPreview();
      setPlayingProgress(0);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-150 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Tìm kiếm nhạc"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">Dành cho bạn</h2>
            {loading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>
        </div>

        <div className="px-4 flex-1 overflow-y-auto">
          {filteredList.length === 0 && !loading ? (
            <p className="text-gray-400 text-sm text-center py-8">
              Không tìm thấy bài hát nào
            </p>
          ) : (
            <div>
              {filteredList.map((music) => (
                <MusicItem
                  key={music.id}
                  music={music}
                  isPlaying={playingId === music.id}
                  isSaved={savedIds.has(music.id)}
                  progress={playingId === music.id ? playingProgress : 0}
                  onPlay={togglePreview}
                  onSave={toggleSave}
                  onSelect={(picked) => {
                    onSelect(picked);
                    stopAudioPreview();
                    setPlayingId(null);
                    onClose?.();
                  }}
                />
              ))}
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full my-3 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? "Đang tải..." : "Tải thêm nhạc"}
                </button>
              )}
            </div>
          )}
          <div className="h-3" />
        </div>
      </div>
    </div>
  );
}
