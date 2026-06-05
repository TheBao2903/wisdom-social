import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { Post } from "../../../types";
import * as postApi from "../../../services/postService";

import {
  enforceVideoAudioState,
  getVideoAudioState,
} from "../../../utils/postVideoAudio";

interface PostCardMediaProps {
  displayPost: Post;
  totalImages: number;
  currentImageIndex: number;
  currentMediaUrl: string;
  currentMediaDuration: number | null;
  isCurrentMediaVideo: boolean;
  locationPathname: string;
  onPrevImage: (e: React.MouseEvent) => void;
  onNextImage: (e: React.MouseEvent) => void;
  onSelectImage: (index: number, e: React.MouseEvent) => void;
  onToggleMusic?: (e: React.MouseEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hasMusic?: boolean;
  isMusicPlaying?: boolean;
}

export default function PostCardMedia({
  displayPost,
  totalImages,
  currentImageIndex,
  currentMediaUrl,
  currentMediaDuration,
  isCurrentMediaVideo,
  locationPathname,
  onPrevImage,
  onNextImage,
  onSelectImage,
  onToggleMusic,
  containerRef,
  videoRef,
  hasMusic = false,
  isMusicPlaying = false,
}: PostCardMediaProps) {
  if (totalImages <= 0) {
    return null;
  }

  const videoAudioState = getVideoAudioState(displayPost.music);

  return (
    <div className="relative w-full group">
      {isCurrentMediaVideo ? (
        <Link
          to={`/post/${displayPost.id}`}
          state={{ from: locationPathname }}
          className="block w-full h-125 bg-black"
        >
          <div ref={containerRef} className="relative w-full h-full">
            <video
              ref={videoRef}
              src={currentMediaUrl}
              className="w-full h-full object-contain cursor-pointer"
              muted={videoAudioState.shouldMuteOriginal}
              playsInline
              preload="metadata"
              controls={!videoAudioState.locked}
              onLoadedMetadata={(e) => {
                enforceVideoAudioState(e.currentTarget, videoAudioState);
              }}
              onVolumeChange={(e) => {
                enforceVideoAudioState(e.currentTarget, videoAudioState);
              }}
              onPlay={(e) => {
                enforceVideoAudioState(e.currentTarget, videoAudioState);
              }}
            />
            {currentMediaDuration !== null && currentMediaDuration > 0 && (
              <div className="absolute top-3 left-3 bg-black/65 text-white text-xs px-2 py-1 rounded-full z-10">
                {postApi.formatMediaDuration(currentMediaDuration)}
              </div>
            )}
          </div>
        </Link>
      ) : (
        <Link
          to={`/post/${displayPost.id}`}
          state={{ from: locationPathname }}
          className="block w-full h-125 bg-black"
        >
          <img
            src={displayPost.images[currentImageIndex] || ""}
            alt={displayPost.caption}
            className="w-full h-full object-contain cursor-pointer"
          />
        </Link>
      )}

      {hasMusic && onToggleMusic && (
        <button
          type="button"
          onClick={onToggleMusic}
          className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label={isMusicPlaying ? "Tắt nhạc" : "Phát nhạc"}
          title={isMusicPlaying ? "Tắt nhạc" : "Phát nhạc"}
        >
          {isMusicPlaying ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      )}

      {totalImages > 1 && (
        <>
          <button
            onClick={onPrevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={onNextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {displayPost.images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => onSelectImage(index, e)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index === currentImageIndex
                    ? "bg-blue-500 w-2 h-2"
                    : "bg-gray-300/70 hover:bg-gray-300"
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>

          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {currentImageIndex + 1} / {totalImages}
          </div>
        </>
      )}
    </div>
  );
}
