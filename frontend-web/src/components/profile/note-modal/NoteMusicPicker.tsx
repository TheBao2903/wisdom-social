import { useState } from "react";
import { Music, Pause, Play, X } from "lucide-react";
import {
  resolveMusicMediaUrl,
  type MusicMetadata,
} from "../../../services/musicService";
import MusicSelector from "./MusicModal";

interface NoteMusicPickerProps {
  selectedMusic: MusicMetadata | null;
  playingUrl: string | null;
  onTogglePreview: (url: string) => void;
  onClearSelection: () => void;
  onSelectMusic: (music: MusicMetadata) => void;
  onOpenSelector?: () => void;
  onCloseSelector?: () => void;
}

export default function NoteMusicPicker({
  selectedMusic,
  playingUrl,
  onTogglePreview,
  onClearSelection,
  onSelectMusic,
  onOpenSelector,
  onCloseSelector,
}: NoteMusicPickerProps) {
  const [showMusicSelector, setShowMusicSelector] = useState(false);
  const selectedImageUrl = resolveMusicMediaUrl(selectedMusic?.imageUrl);
  const selectedAudioUrl = resolveMusicMediaUrl(selectedMusic?.audioUrl);

  const handleOpenSelector = () => {
    setShowMusicSelector(true);
    onOpenSelector?.();
  };

  const handleCloseSelector = () => {
    setShowMusicSelector(false);
    onCloseSelector?.();
  };

  return (
    <div className="space-y-2">
      {selectedMusic ? (
        <div className="flex items-center gap-3 px-3 py-2 border rounded-xl bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <button
            type="button"
            onClick={handleOpenSelector}
            className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-lg hover:bg-blue-100/60 dark:hover:bg-blue-800/30 transition-colors p-1 -m-1"
            title="Chọn lại nhạc"
          >
            <img
              src={selectedImageUrl}
              alt={selectedMusic.title}
              className="w-9 h-9 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold dark:text-white truncate">
                {selectedMusic.title}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {selectedMusic.artist}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onTogglePreview(selectedAudioUrl)}
            className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Preview music"
          >
            {playingUrl === selectedAudioUrl ? (
              <Pause className="w-3 h-3 text-gray-700 dark:text-gray-300" />
            ) : (
              <Play className="w-3 h-3 text-gray-700 dark:text-gray-300" />
            )}
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Remove music"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpenSelector}
          className="w-full flex items-center gap-2 px-3 py-2 border dark:border-gray-700 rounded-xl dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Music className="w-4 h-4 shrink-0" />
          <span>Add music from library...</span>
        </button>
      )}

      {showMusicSelector && (
        <MusicSelector
          onSelect={(music) => {
            onSelectMusic(music);
            handleCloseSelector();
          }}
          onClose={handleCloseSelector}
        />
      )}
    </div>
  );
}
