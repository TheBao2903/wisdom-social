import { useRef, useCallback, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import StoryTextLayer from "./StoryTextLayer";
import StoryToolbar from "./StoryToolbar";
import StoryMusicSticker from "./StoryMusicSticker";
import type { StoryTextManager } from "../../hooks/useStoryTextManager";
import type { StoryMusicManager } from "../../hooks/useStoryMusicSticker";

interface Props {
  manager: StoryTextManager;
  musicManager?: StoryMusicManager;
  backgroundUrl?: string;
  backgroundType?: "image" | "video";
  gradientClass?: string;
  mediaOffsetX?: number;
  mediaOffsetY?: number;
  mediaScale?: number;
  onMediaMouseDown?: (e: any) => void;
  onMediaTouchStart?: (e: any) => void;
  videoMuted?: boolean;
  onToggleMute?: () => void;
}

export default function StoryCanvas({
  manager,
  musicManager,
  backgroundUrl,
  backgroundType = "image",
  gradientClass,
  mediaOffsetX = 0,
  mediaOffsetY = 0,
  mediaScale = 1,
  onMediaMouseDown,
  onMediaTouchStart,
  videoMuted = false,
  onToggleMute,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Click on canvas background => deselect all (but not while editing)
  const handleCanvasClick = useCallback(
    (_e: React.MouseEvent) => {
      // Don't deselect if currently editing text
      if (manager.editingId) {
        return;
      }

      // Any click that bubbles up here means it wasn't on a sticker/text
      // (those call e.stopPropagation). Deselect everything.
      manager.deselectAll();
      musicManager?.deselectSticker();
    },
    [manager, musicManager]
  );

  // ESC key to deselect or exit edit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (manager.editingId) {
          manager.setEditingId(null);
        } else {
          manager.deselectAll();
          musicManager?.deselectSticker();
        }
      }
      // Delete selected layer
      if ((e.key === "Delete" || e.key === "Backspace") && !manager.editingId) {
        if (manager.selectedId) {
          manager.removeLayer(manager.selectedId);
        } else if (musicManager?.isSelected && musicManager?.sticker) {
          musicManager.removeSticker();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [manager, musicManager]);

  const hasBackground = backgroundUrl || gradientClass;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full max-w-[360px] aspect-[9/16] rounded-2xl overflow-visible shadow-[0_8px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
        onClick={handleCanvasClick}
        style={{ cursor: "default" }}
      >
        {/* Background */}
        {gradientClass && !backgroundUrl && (
          <div className={`absolute inset-0 ${gradientClass}`} />
        )}

        {backgroundUrl && backgroundType === "image" && (
          <img
            src={backgroundUrl}
            alt="Story background"
            className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"
            style={{
              transform: `translate(${mediaOffsetX}px, ${mediaOffsetY}px) scale(${mediaScale})`,
              transformOrigin: "center",
            }}
            onMouseDown={(e) => onMediaMouseDown?.(e as any)}
            onTouchStart={(e) => onMediaTouchStart?.(e as any)}
          />
        )}

        {backgroundUrl && backgroundType === "video" && (
          <video
            src={backgroundUrl}
            className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"
            style={{
              transform: `translate(${mediaOffsetX}px, ${mediaOffsetY}px) scale(${mediaScale})`,
              transformOrigin: "center",
            }}
            autoPlay
            muted={videoMuted}
            loop
            playsInline
            onMouseDown={(e) => onMediaMouseDown?.(e as any)}
            onTouchStart={(e) => onMediaTouchStart?.(e as any)}
          />
        )}

        {/* Floating Mute Button for Video */}
        {backgroundUrl && backgroundType === "video" && onToggleMute && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="absolute top-4 left-4 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-lg transition-all z-20 flex items-center justify-center border border-white/10"
            title={videoMuted ? "Bật âm thanh" : "Tắt âm thanh"}
          >
            {videoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}

        {/* Gradient overlay for text readability */}
        {backgroundUrl && (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none" />
            <div className="absolute inset-0 bg-black/5 pointer-events-none" />
          </>
        )}

        {/* Empty state */}
        {!hasBackground &&
          manager.layers.length === 0 &&
          !musicManager?.sticker && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center text-white/20">
                <p className="text-sm font-medium">Bắt đầu tạo story</p>
                <p className="text-[11px] mt-1">Nhấn "Aa" để thêm văn bản</p>
              </div>
            </div>
          )}

        {/* Default dark bg when no gradient */}
        {!hasBackground &&
          (manager.layers.length > 0 || musicManager?.sticker) && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
          )}

        {/* Text Layers */}
        {manager.layers.map((layer) => (
          <StoryTextLayer
            key={layer.id}
            layer={layer}
            isSelected={layer.id === manager.selectedId}
            isEditing={layer.id === manager.editingId}
            canvasRef={canvasRef}
            onSelect={(id) => {
              manager.setSelectedId(id);
              if (manager.editingId && manager.editingId !== id) {
                manager.setEditingId(null);
              }
              musicManager?.deselectSticker();
            }}
            onStartEdit={(id) => {
              manager.setSelectedId(id);
              manager.setEditingId(id);
              musicManager?.deselectSticker();
            }}
            onEndEdit={(_id) => {
              manager.deselectAll();
              musicManager?.deselectSticker();
            }}
            onUpdate={manager.updateLayer}
          />
        ))}

        {/* Music Sticker */}
        {musicManager?.sticker && (
          <StoryMusicSticker
            sticker={musicManager.sticker}
            isSelected={musicManager.isSelected}
            canvasRef={canvasRef}
            onSelect={() => {
              musicManager.selectSticker();
              manager.deselectAll();
            }}
            onUpdate={musicManager.updateSticker}
            onCycleStyle={musicManager.cycleStyle}
            onRemove={musicManager.removeSticker}
          />
        )}

        {/* Canvas border glow when editing */}
        {manager.editingId && (
          <div className="absolute inset-0 ring-2 ring-blue-400/20 rounded-2xl pointer-events-none" />
        )}
      </div>

      {/* Toolbar - Text Tools */}
      <div className="flex items-center gap-2 w-full max-w-[360px]">
        {/* Text Toolbar */}
        <StoryToolbar manager={manager} />
      </div>
    </div>
  );
}
