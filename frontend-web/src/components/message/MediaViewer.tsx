import {
    ChevronLeft,
    ChevronRight,
    Forward,
    RotateCw,
    Save,
    ScanSearch,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent,
    type WheelEvent,
} from "react";
import ImagePreviewSidebar from "./ImagePreviewSidebar";

export type MediaViewerImage = {
    url: string;
    messageId?: string;
    senderId?: number;
    senderName?: string;
    createdAt?: string;
};

type Props = {
    open: boolean;
    images: MediaViewerImage[];
    currentIndex: number;
    onClose: () => void;
    onIndexChange: (index: number) => void;
    onForward?: (image: MediaViewerImage) => void;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const SCALE_STEP = 0.25;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function formatViewerDate(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export default function MediaViewer({
    open,
    images,
    currentIndex,
    onClose,
    onIndexChange,
    onForward,
    hasMore = false,
    loadingMore = false,
    onLoadMore,
}: Props) {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const dragRef = useRef<{
        active: boolean;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);

    const safeIndex = clamp(currentIndex, 0, Math.max(images.length - 1, 0));
    const image = images[safeIndex];
    const canNavigate = images.length > 1;

    const resetView = useCallback(() => {
        setScale(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
    }, []);

    const goTo = useCallback(
        (index: number) => {
            if (!images.length) return;
            onIndexChange((index + images.length) % images.length);
        },
        [images.length, onIndexChange],
    );

    const next = useCallback(() => goTo(safeIndex + 1), [goTo, safeIndex]);
    const prev = useCallback(() => goTo(safeIndex - 1), [goTo, safeIndex]);

    useEffect(() => {
        if (!open || !hasMore || loadingMore || !onLoadMore) return;
        if (safeIndex >= images.length - 3) {
            onLoadMore();
        }
    }, [hasMore, images.length, loadingMore, onLoadMore, open, safeIndex]);

    useEffect(() => {
        if (!open) return;
        resetView();
        setLoaded(false);
    }, [image?.url, open, resetView]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowRight") next();
            if (event.key === "ArrowLeft") prev();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [next, onClose, open, prev]);

    const toolbarButtonClass =
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40";

    const transform = useMemo(
        () =>
            `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
        [offset.x, offset.y, rotation, scale],
    );

    const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const delta = event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
        setScale((value) => clamp(value + delta, MIN_SCALE, MAX_SCALE));
    };

    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (scale <= 1) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            active: true,
            startX: event.clientX,
            startY: event.clientY,
            originX: offset.x,
            originY: offset.y,
        };
    };

    const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag?.active) return;
        setOffset({
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
        });
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    const download = async () => {
        if (!image?.url) return;
        if (saving) return;
        setSaving(true);
        const rawName = image.url.split("/").pop()?.split("?")[0] || "image";
        const ensureImageExtension = (name: string, mimeType?: string) => {
            if (/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(name)) return name;
            if (mimeType?.includes("png")) return `${name}.png`;
            if (mimeType?.includes("webp")) return `${name}.webp`;
            if (mimeType?.includes("gif")) return `${name}.gif`;
            if (mimeType?.includes("avif")) return `${name}.avif`;
            return `${name}.jpg`;
        };

        const picker = (window as unknown as {
            showSaveFilePicker?: (options?: {
                suggestedName?: string;
                types?: Array<{
                    description: string;
                    accept: Record<string, string[]>;
                }>;
            }) => Promise<{
                createWritable: () => Promise<{
                    write: (data: Blob) => Promise<void>;
                    close: () => Promise<void>;
                }>;
            }>;
        }).showSaveFilePicker;

        try {
            const downloadUrl = `/api/files/download?url=${encodeURIComponent(image.url)}`;
            const response = await fetch(downloadUrl, {
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error("Không thể tải ảnh");
            }
            const blob = await response.blob();
            const fileName = ensureImageExtension(rawName, blob.type);

            if (picker) {
                const handle = await picker({
                    suggestedName: fileName,
                    types: [
                        {
                            description: "Image",
                            accept: {
                                "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
                            },
                        },
                    ],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            }

            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = fileName;
            anchor.rel = "noopener noreferrer";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch (error) {
            if ((error as { name?: string })?.name !== "AbortError") {
                window.alert("Không thể lưu ảnh này. Vui lòng thử lại.");
            }
        } finally {
            setSaving(false);
        }
    };

    if (!open || !image) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex bg-black/92 text-white" style={{ animation: "mediaViewerFade 160ms ease-out" }}>
            <style>
                {`@keyframes mediaViewerFade { from { opacity: 0; transform: scale(0.99); } to { opacity: 1; transform: scale(1); } }`}
            </style>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black/35 px-4">
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                            {image.senderName || "Ảnh trong cuộc trò chuyện"}
                        </p>
                        <p className="truncate text-xs text-white/60">
                            {formatViewerDate(image.createdAt)}
                        </p>
                    </div>
                    <p className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                        {safeIndex + 1} / {images.length}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/90 text-white transition hover:bg-red-500"
                        aria-label="Đóng"
                        title="Đóng"
                    >
                        <X size={21} />
                    </button>
                </header>

                <main
                    className="relative min-h-0 flex-1 overflow-hidden"
                    onWheel={handleWheel}
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onDoubleClick={() =>
                        setScale((value) => (value > 1 ? 1 : 2))
                    }
                >
                    {!loaded && (
                        <div className="absolute inset-0 m-auto h-24 w-24 animate-pulse rounded-xl bg-white/10" />
                    )}
                    {canNavigate && (
                        <>
                            <button
                                type="button"
                                onClick={prev}
                className="absolute left-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65 md:left-[18rem]"
                                aria-label="Ảnh trước"
                            >
                                <ChevronLeft size={28} />
                            </button>
                            <button
                                type="button"
                                onClick={next}
                                className="absolute right-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
                                aria-label="Ảnh tiếp theo"
                            >
                                <ChevronRight size={28} />
                            </button>
                        </>
                    )}
                    <div className="flex h-full w-full items-center justify-center px-5 py-5">
                        <img
                            src={image.url}
                            alt="Hình ảnh"
                            draggable={false}
                            onLoad={() => setLoaded(true)}
                            className="max-h-full max-w-full select-none rounded-md object-contain shadow-2xl transition-transform duration-150"
                            style={{
                                transform,
                                cursor: scale > 1 ? "grab" : "zoom-in",
                            }}
                        />
                    </div>
                </main>

                <footer className="flex h-16 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black/35 px-4">
                    <button
                        type="button"
                        className={toolbarButtonClass}
                        onClick={() =>
                            setScale((value) =>
                                clamp(value - SCALE_STEP, MIN_SCALE, MAX_SCALE),
                            )
                        }
                        aria-label="Thu nhỏ"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <button
                        type="button"
                        className={toolbarButtonClass}
                        onClick={() =>
                            setScale((value) =>
                                clamp(value + SCALE_STEP, MIN_SCALE, MAX_SCALE),
                            )
                        }
                        aria-label="Phóng to"
                    >
                        <ZoomIn size={20} />
                    </button>
                    <button
                        type="button"
                        className={toolbarButtonClass}
                        onClick={resetView}
                        aria-label="Reset"
                    >
                        <ScanSearch size={20} />
                    </button>
                    <button
                        type="button"
                        className={toolbarButtonClass}
                        onClick={() => setRotation((value) => value + 90)}
                        aria-label="Xoay ảnh"
                    >
                        <RotateCw size={20} />
                    </button>
                    <button
                        type="button"
                        className={toolbarButtonClass}
                        onClick={download}
                        disabled={saving}
                        aria-label="Lưu ảnh"
                        title="Lưu ảnh"
                    >
                        <Save size={20} />
                    </button>
                    <button
                        type="button"
                        className={toolbarButtonClass}
                        onClick={() => onForward?.(image)}
                        disabled={!onForward}
                        aria-label="Chuyển tiếp"
                        title="Chuyển tiếp"
                    >
                        <Forward size={20} />
                    </button>
                </footer>

                <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-black/45 px-4 py-2 lg:hidden">
                    {images.map((item, index) => (
                        <button
                            key={`${item.url}-${index}`}
                            type="button"
                            onClick={() => goTo(index)}
                            className={`h-14 w-14 shrink-0 overflow-hidden rounded ${
                                index === safeIndex ? "ring-2 ring-white" : ""
                            }`}
                        >
                            <img
                                src={item.url}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            </div>
            <ImagePreviewSidebar
                images={images}
                currentIndex={safeIndex}
                onSelect={goTo}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={onLoadMore}
            />
        </div>
    );
}
