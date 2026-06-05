import type { MediaViewerImage } from "./MediaViewer";

type Props = {
    images: MediaViewerImage[];
    currentIndex: number;
    onSelect: (index: number) => void;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
};

function formatThumbDate(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
    });
}

export default function ImagePreviewSidebar({
    images,
    currentIndex,
    onSelect,
    hasMore = false,
    loadingMore = false,
    onLoadMore,
}: Props) {
    return (
        <aside className="hidden h-full w-28 shrink-0 overflow-y-auto border-l border-white/10 bg-black/35 px-3 py-4 lg:block">
            <div className="space-y-3">
                {images.map((image, index) => (
                    <button
                        key={`${image.url}-${index}`}
                        type="button"
                        onClick={() => onSelect(index)}
                        className={`group w-full rounded-md p-1 text-left transition ${
                            index === currentIndex
                                ? "bg-white/18 ring-2 ring-white"
                                : "bg-white/6 hover:bg-white/14"
                        }`}
                    >
                        <span className="mb-1 block text-center text-xs font-semibold text-white/70">
                            {formatThumbDate(image.createdAt)}
                        </span>
                        <img
                            src={image.url}
                            alt=""
                            className="aspect-square w-full rounded object-cover"
                            loading="lazy"
                        />
                    </button>
                ))}
                {hasMore && (
                    <button
                        type="button"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="w-full rounded-md bg-white/10 px-2 py-2 text-xs font-semibold text-white transition hover:bg-white/18 disabled:opacity-60"
                    >
                        {loadingMore ? "Đang tải..." : "Xem thêm"}
                    </button>
                )}
            </div>
        </aside>
    );
}
