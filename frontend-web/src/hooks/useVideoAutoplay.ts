import { useCallback, useEffect, useRef } from "react";
import { videoFeedManager } from "../services/VideoFeedManager";

type UseVideoAutoplayOptions = {
    videoId: string;
    enabled: boolean;
    focusRatio?: number;
    maxPlaySeconds?: number;
};

export default function useVideoAutoplay({
    videoId,
    enabled,
    focusRatio = 0.7,
    maxPlaySeconds = 15,
}: UseVideoAutoplayOptions) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isFocusedRef = useRef(false);
    const manualPausedRef = useRef(false);
    const requireReenterRef = useRef(false);

    const clearPlayTimer = useCallback(() => {
        if (!timerRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    const pauseVideo = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        clearPlayTimer();
        video.pause();
    }, [clearPlayTimer]);

    const clampToMax = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.currentTime >= maxPlaySeconds) {
            video.currentTime = maxPlaySeconds;
            pauseVideo();
            videoFeedManager.pauseIfActive(videoId);
        }
    }, [maxPlaySeconds, pauseVideo, videoId]);

    const scheduleMaxTimer = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        clearPlayTimer();
        const remain = maxPlaySeconds - video.currentTime;

        if (remain <= 0) {
            clampToMax();
            return;
        }

        timerRef.current = setTimeout(() => {
            clampToMax();
        }, remain * 1000);
    }, [clearPlayTimer, clampToMax, maxPlaySeconds]);

    const playVideo = useCallback(() => {
        const video = videoRef.current;
        if (!video || !enabled || !isFocusedRef.current) return;
        if (videoFeedManager.getActiveVideoId() !== videoId) return;
        if (manualPausedRef.current && requireReenterRef.current) return;

        if (video.currentTime >= maxPlaySeconds) {
            video.currentTime = maxPlaySeconds;
            pauseVideo();
            return;
        }

        video.muted = true;
        video.playsInline = true;

        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => undefined);
        }

        scheduleMaxTimer();
    }, [enabled, maxPlaySeconds, pauseVideo, scheduleMaxTimer, videoId]);

    const onVideoClick = useCallback(
        (e: React.MouseEvent<HTMLVideoElement>) => {
            e.preventDefault();
            e.stopPropagation();

            const video = videoRef.current;
            if (!video || !enabled) return;

            if (video.paused) {
                manualPausedRef.current = false;
                requireReenterRef.current = false;
                videoFeedManager.setActiveVideo(videoId);
                playVideo();
                return;
            }

            manualPausedRef.current = true;
            requireReenterRef.current = true;
            pauseVideo();
            videoFeedManager.pauseIfActive(videoId);
        },
        [enabled, pauseVideo, playVideo, videoId]
    );

    useEffect(() => {
        if (!enabled) {
            pauseVideo();
            isFocusedRef.current = false;
            observerRef.current?.disconnect();
            observerRef.current = null;
            videoFeedManager.pauseIfActive(videoId);
            videoFeedManager.unregister(videoId);
            return;
        }

        const handlePlay = () => {
            if (videoFeedManager.getActiveVideoId() !== videoId) {
                pauseVideo();
                return;
            }
            scheduleMaxTimer();
        };

        const handlePause = () => {
            clearPlayTimer();
        };

        const handleTimeUpdate = () => {
            if (videoFeedManager.getActiveVideoId() !== videoId) return;
            clampToMax();
        };

        videoFeedManager.register(videoId, {
            play: playVideo,
            pause: pauseVideo,
        });

        const node = containerRef.current;
        const video = videoRef.current;

        if (video) {
            video.addEventListener("play", handlePlay);
            video.addEventListener("pause", handlePause);
            video.addEventListener("timeupdate", handleTimeUpdate);
        }

        if (node) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];
                    if (!entry) return;

                    const focused = entry.isIntersecting && entry.intersectionRatio >= focusRatio;
                    isFocusedRef.current = focused;

                    if (!focused) {
                        requireReenterRef.current = manualPausedRef.current || requireReenterRef.current;
                        pauseVideo();
                        videoFeedManager.pauseIfActive(videoId);
                        return;
                    }

                    if (manualPausedRef.current && requireReenterRef.current) {
                        manualPausedRef.current = false;
                        requireReenterRef.current = false;
                    }

                    videoFeedManager.setActiveVideo(videoId);
                },
                { threshold: [0.25, 0.5, 0.7, 0.9] }
            );

            observerRef.current.observe(node);
        }

        return () => {
            observerRef.current?.disconnect();
            observerRef.current = null;
            clearPlayTimer();
            pauseVideo();
            if (video) {
                video.removeEventListener("play", handlePlay);
                video.removeEventListener("pause", handlePause);
                video.removeEventListener("timeupdate", handleTimeUpdate);
            }
            videoFeedManager.pauseIfActive(videoId);
            videoFeedManager.unregister(videoId);
        };
    }, [
        clearPlayTimer,
        clampToMax,
        enabled,
        focusRatio,
        pauseVideo,
        playVideo,
        scheduleMaxTimer,
        videoId,
    ]);

    return {
        containerRef,
        videoRef,
        onVideoClick,
    };
}
