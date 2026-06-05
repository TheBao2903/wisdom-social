import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import { Pause, Play } from "lucide-react";

interface AudioPlayerProps {
    src: string;
    isOwn: boolean;
}

export default function AudioPlayer({ src, isOwn }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Tạo waveform bars giả - seeded theo URL để mỗi tin nhắn có cùng 1 waveform
    // (không decode thật audio vì tốn CPU, fake này đủ dùng cho UI)
    const bars = useMemo(() => {
        // Hash URL thành số seed cố định, tránh mutate biến trong render.
        const seed = src
            .split("")
            .reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 17);
        // Tạo 30 cột giả lập dựa trên seed + index để mỗi tin luôn ổn định.
        return Array.from({ length: 30 }, (_, index) => {
            const seeded = Math.imul(
                seed ^ ((index + 1) * 2654435761),
                1103515245,
            );
            return 15 + (Math.abs(seeded) % 70); // 15-85 %
        });
    }, [src]);

    const togglePlay = useCallback(() => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) a.pause();
        else void a.play();
    }, [playing]);

    const handleSeek = useCallback((e: MouseEvent<HTMLDivElement>) => {
        const a = audioRef.current;
        if (!a || !a.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        // Tính % vị trí click -> tua audio đến % đó
        a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
    }, []);

    const progress = duration > 0 ? currentTime / duration : 0;

    const fmt = (s: number) => {
        const m = Math.floor(s / 60);
        return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    };

    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 w-full min-w-55">
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    setCurrentTime(0);
                }}
                onTimeUpdate={() =>
                    setCurrentTime(audioRef.current?.currentTime ?? 0)
                }
                onLoadedMetadata={() =>
                    setDuration(audioRef.current?.duration ?? 0)
                }
            />

            <button
                type="button"
                onClick={togglePlay}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isOwn
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-gray-900 hover:bg-gray-700 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
                }`}
            >
                {playing ? (
                    <Pause size={16} fill="currentColor" />
                ) : (
                    <Play size={16} fill="currentColor" />
                )}
            </button>

            <div
                className="flex-1 flex items-center gap-0.5 h-8 cursor-pointer"
                onClick={handleSeek}
            >
                {bars.map((h, i) => {
                    const played = i / bars.length <= progress;
                    return (
                        <div
                            key={i}
                            className={`rounded-full flex-1 transition-colors ${
                                played
                                    ? isOwn
                                        ? "bg-white"
                                        : "bg-gray-900 dark:bg-gray-100"
                                    : isOwn
                                      ? "bg-white/35"
                                      : "bg-gray-300 dark:bg-gray-500"
                            }`}
                            style={{ height: `${h}%` }}
                        />
                    );
                })}
            </div>

            <span
                className={`text-xs shrink-0 font-mono tabular-nums ${
                    isOwn ? "text-blue-100" : "text-gray-700 dark:text-gray-300"
                }`}
            >
                {currentTime > 0 ? fmt(currentTime) : fmt(duration)}
            </span>
        </div>
    );
}
