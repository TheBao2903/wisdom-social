/**
 * 📌 PostMediaViewer Component
 *
 * Responsibility:
 * - Render images and videos with proper sizing
 * - Handle slider navigation (prev/next/dots)
 * - Auto-play video for 15 seconds
 * - Display image counter and media indicators
 *
 * Why:
 * - Isolates media rendering logic from PostModal
 * - Video autoplay lifecycle is complex, keep it isolated
 * - Makes media handling independently testable
 *
 * Props:
 * - post: PostData
 * - currentImageIndex: number
 * - transformedMediaUrls: string[]
 * - modalVideoRef: RefObject<HTMLVideoElement>
 * - onImageChange: (index: number) => void
 *
 * Side Effects:
 * - useEffect: Handles video autoplay + auto-pause (15s)
 * - When post changes, resets image index to 0
 *
 * Notes:
 * - Video autoplay is DISABLED by default, only shows on user interaction
 * - Auto-pauses after 15 seconds
 * - Dots and arrows only show if multiple images
 */

import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as postApi from "../../../services/postService";
import type { PostData } from "../../../types/post";
import {
  enforceVideoAudioState,
  getVideoAudioState,
} from "../../../utils/postVideoAudio";

interface PostMediaViewerProps {
  post: PostData;
  currentImageIndex: number;
  transformedMediaUrls: string[];
  modalVideoRef: React.RefObject<HTMLVideoElement | null>;
  onImageChange: (index: number) => void;
}

const PostMediaViewer: React.FC<PostMediaViewerProps> = ({
  post,
  currentImageIndex,
  transformedMediaUrls,
  modalVideoRef,
  onImageChange,
}) => {
  const hasMedia = post.media && post.media.length > 0;
  const totalImages = post?.media?.length || 0;
  const safePostContent = post.content || "";
  const videoAudioState = getVideoAudioState(post.music);

  const isVideoAtIndex = (index: number) => {
    const media = post.media?.[index];
    const url = transformedMediaUrls[index] || "";
    return postApi.isVideoMedia(url, media?.type);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onImageChange(
      currentImageIndex === 0 ? totalImages - 1 : currentImageIndex - 1
    );
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onImageChange(
      currentImageIndex === totalImages - 1 ? 0 : currentImageIndex + 1
    );
  };

  // Video autoplay + auto-pause after 15 seconds
  useEffect(() => {
    const video = modalVideoRef.current;
    let timeout: NodeJS.Timeout;

    if (!post || !post.media || post.media.length === 0) {
      video?.pause();
      return;
    }

    const currentMedia = post.media[currentImageIndex];
    const currentUrl = transformedMediaUrls[currentImageIndex] || "";
    const isVideo = postApi.isVideoMedia(currentUrl, currentMedia?.type);

    if (!isVideo || !video) {
      video?.pause();
      return;
    }

    enforceVideoAudioState(video, videoAudioState);
    video.playsInline = true;

    const play = async () => {
      try {
        await video.play();

        // ⏱ Auto pause after 15 seconds
        timeout = setTimeout(() => {
          video.pause();
        }, 15000);
      } catch (err) {
        // User interaction required for autoplay, ignore error
      }
    };

    play();

    return () => {
      video.pause();
      if (timeout) clearTimeout(timeout);
    };
  }, [currentImageIndex, transformedMediaUrls, post, modalVideoRef, videoAudioState]);

  return (
    <div className="flex-1 bg-black flex items-center justify-center relative group">
      {hasMedia ? (
        <>
          {/* Media Renderer */}
          {isVideoAtIndex(currentImageIndex) ? (
            <video
              key={currentImageIndex}
              ref={modalVideoRef}
              src={transformedMediaUrls[currentImageIndex] || ""}
              className="max-h-[90vh] max-w-full object-contain"
              autoPlay
              muted={videoAudioState.shouldMuteOriginal}
              playsInline
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
          ) : (
            <img
              src={transformedMediaUrls[currentImageIndex] || ""}
              alt="Post content"
              className="max-h-[90vh] max-w-full object-contain"
            />
          )}

          {/* Navigation Controls - Only show if multiple images */}
          {totalImages > 1 && (
            <>
              {/* Previous Button */}
              <button
                onClick={handlePrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>

              {/* Next Button */}
              <button
                onClick={handleNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>

              {/* Dots Indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {post.media!.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onImageChange(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentImageIndex
                        ? "bg-blue-500 w-2.5 h-2.5"
                        : "bg-gray-300/70 hover:bg-gray-300"
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>

              {/* Image Counter */}
              <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1.5 rounded-full z-10">
                {currentImageIndex + 1} / {totalImages}
              </div>
            </>
          )}
        </>
      ) : (
        /* No Media - Show Text Content */
        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
          <p className="text-4xl font-bold text-gray-400 dark:text-gray-600 px-8 text-center">
            {safePostContent}
          </p>
        </div>
      )}
    </div>
  );
};

export default PostMediaViewer;
