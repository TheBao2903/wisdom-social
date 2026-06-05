import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { musicFeedManager } from "../services/MusicFeedManager";
import {
  playAudioPreview,
  resolveMusicMediaUrl,
  stopAudioPreview,
  subscribeToPlayback,
} from "../services/musicService";

type UseMusicAutoplayOptions = {
  musicId: string;
  audioPath?: string | null;
  enabled: boolean;
  focusRatio?: number;
  autoPlayOnFocus?: boolean;
};

export default function useMusicAutoplay({
  musicId,
  audioPath,
  enabled,
  focusRatio = 0.65,
  autoPlayOnFocus = true,
}: UseMusicAutoplayOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const audioUrl = useMemo(() => resolveMusicMediaUrl(audioPath), [audioPath]);

  useEffect(() => {
    return subscribeToPlayback((url) => setPlayingUrl(url));
  }, []);

  const playMusic = useCallback(() => {
    if (!enabled || !audioUrl) return;
    playAudioPreview(audioUrl);
  }, [audioUrl, enabled]);

  const pauseMusic = useCallback(() => {
    if (!audioUrl) return;
    if (playingUrl === audioUrl) {
      stopAudioPreview();
    }
  }, [audioUrl, playingUrl]);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!enabled || !audioUrl) return;

      if (playingUrl === audioUrl) {
        stopAudioPreview();
        return;
      }

      musicFeedManager.setActiveMusic(musicId);
    },
    [audioUrl, enabled, musicId, playingUrl]
  );

  useEffect(() => {
    if (!enabled || !audioUrl) {
      musicFeedManager.pauseIfActive(musicId);
      musicFeedManager.unregister(musicId);
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    musicFeedManager.register(musicId, {
      play: playMusic,
      pause: pauseMusic,
    });

    if (!autoPlayOnFocus) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return () => {
        musicFeedManager.pauseIfActive(musicId);
        musicFeedManager.unregister(musicId);
      };
    }

    const node = containerRef.current;
    if (node) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;

          const focused =
            entry.isIntersecting && entry.intersectionRatio >= focusRatio;

          if (!focused) {
            musicFeedManager.pauseIfActive(musicId);
            return;
          }

          musicFeedManager.setActiveMusic(musicId);
        },
        { threshold: [0.25, 0.5, 0.65, 0.8] }
      );

      observerRef.current.observe(node);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      musicFeedManager.pauseIfActive(musicId);
      musicFeedManager.unregister(musicId);
    };
  }, [audioUrl, autoPlayOnFocus, enabled, focusRatio, musicId, pauseMusic, playMusic]);

  return {
    containerRef,
    playingUrl,
    audioUrl,
    togglePlay,
  };
}
