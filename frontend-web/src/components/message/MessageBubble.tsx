import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    MoreVertical,
    Undo2,
    Copy,
    Pin,
    Reply,
    Star,
    ListChecks,
    Info,
    ChevronRight,
    Trash2,
    Paperclip,
    Play,
    Pause,
    Phone,
    PhoneOff,
    Video,
    VideoOff,
    Mic,
    FolderOpen,
    Download,
    File,
    FileText,
    FileSpreadsheet,
    FileVideoCamera,
    Presentation,
    CheckCircle2,
    Image as ImageIcon,
} from "lucide-react";
import type {
    Message,
    MessageAttachment,
    MessageType,
} from "../../services/chatService";

/**
 * Kiểm tra xem một chuỗi có chỉ chứa emoji (không có text khác) hay không
 * Regex bao gồm các dải Unicode của emoji phổ biến
 */
function isEmojiOnly(text: string): boolean {
    if (!text) return false;
    // Dùng nhóm thay vì character class để tránh false-positive từ eslint.
    const emojiRegex =
        /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+$/u;
    // Kiểm tra có ít nhất 1 emoji và không có ký tự text thường
    const hasEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(
        text,
    );
    return hasEmoji && emojiRegex.test(text.trim());
}

/**
 * Tách tên file từ URL để hiển thị gọn trong các preview system message.
 */
function getFileNameFromUrl(
    url: string | undefined,
    fallback = "tệp đính kèm",
) {
    if (!url) return fallback;
    return url.split("/").pop()?.split("?")[0] ?? fallback;
}

function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${mb.toFixed(2)} MB`;
}

type FileCategory = "video" | "pdf" | "word" | "excel" | "ppt" | "other";

const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm"]);
const IMAGE_FILE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "avif",
    "heic",
]);
const AUDIO_FILE_EXTENSIONS = new Set([
    "mp3",
    "wav",
    "ogg",
    "aac",
    "m4a",
    "opus",
    "weba",
]);
const WORD_FILE_EXTENSIONS = new Set(["doc", "docx"]);
const EXCEL_FILE_EXTENSIONS = new Set(["xls", "xlsx"]);
const PPT_FILE_EXTENSIONS = new Set(["ppt", "pptx"]);

const WORD_MIME_TYPES = new Set([
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const EXCEL_MIME_TYPES = new Set([
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const PPT_MIME_TYPES = new Set([
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

interface ReplyMediaPayload {
    type?: MessageType;
    content?: string;
    fileName?: string;
    mimeType?: string;
}

interface ParsedReplyContent {
    sourceUrl?: string;
    thumbnailUrl?: string;
    posterUrl?: string;
    fileName?: string;
    mimeType?: string;
    text?: string;
}

function getFileExtension(fileName: string): string {
    return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeMimeType(mimeType?: string): string {
    if (!mimeType) return "";
    return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function isImageFile(fileName?: string, mimeType?: string): boolean {
    const normalizedMime = normalizeMimeType(mimeType);
    if (normalizedMime.startsWith("image/")) return true;

    if (!fileName) return false;
    const ext = getFileExtension(fileName);
    return IMAGE_FILE_EXTENSIONS.has(ext);
}

function isAudioFile(fileName?: string, mimeType?: string): boolean {
    const normalizedMime = normalizeMimeType(mimeType);
    if (normalizedMime.startsWith("audio/")) return true;

    if (!fileName) return false;
    const ext = getFileExtension(fileName);
    return AUDIO_FILE_EXTENSIONS.has(ext);
}

function isVideoFile(fileName?: string, mimeType?: string): boolean {
    if (isAudioFile(fileName, mimeType)) return false;

    const normalizedMime = normalizeMimeType(mimeType);
    if (normalizedMime.startsWith("video/")) return true;

    if (!fileName) return false;
    const ext = getFileExtension(fileName);
    return VIDEO_FILE_EXTENSIONS.has(ext);
}

function getReplyMediaType(
    message?: ReplyMediaPayload | null,
): "image" | "video" | "other" {
    if (!message) return "other";

    if (message.type === "IMAGE") return "image";
    if (message.type === "VIDEO") return "video";
    if (message.type === "AUDIO") return "other";

    const candidateName = message.fileName || message.content;
    if (isAudioFile(candidateName, message.mimeType)) return "other";
    if (isImageFile(candidateName, message.mimeType)) return "image";
    if (isVideoFile(candidateName, message.mimeType)) return "video";
    return "other";
}

function isLikelyMediaSource(value?: string): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    return (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("blob:") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("/") ||
        normalized.includes("/") ||
        normalized.includes(".jpg") ||
        normalized.includes(".jpeg") ||
        normalized.includes(".png") ||
        normalized.includes(".gif") ||
        normalized.includes(".webp") ||
        normalized.includes(".mp4") ||
        normalized.includes(".mov") ||
        normalized.includes(".avi") ||
        normalized.includes(".mkv") ||
        normalized.includes(".webm")
    );
}

function parseReplyContent(content?: string): ParsedReplyContent {
    const raw = content?.trim();
    if (!raw) return {};

    if (raw.startsWith("{") && raw.endsWith("}")) {
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const getString = (...keys: string[]) => {
                for (const key of keys) {
                    const value = parsed[key];
                    if (typeof value === "string" && value.trim()) {
                        return value;
                    }
                }
                return undefined;
            };

            return {
                sourceUrl: getString("url", "fileUrl", "src", "content"),
                thumbnailUrl: getString(
                    "thumbnailUrl",
                    "thumbnail",
                    "previewUrl",
                ),
                posterUrl: getString("posterUrl", "poster"),
                fileName: getString("fileName", "name"),
                mimeType: getString("mimeType", "type", "contentType"),
                text: getString("text", "caption", "message"),
            };
        } catch {
            // Fallback dùng raw content phía dưới.
        }
    }

    return {
        sourceUrl: raw,
        fileName: getFileNameFromUrl(raw, ""),
        text: raw,
    };
}

function resolveFileCategory(
    fileName: string,
    mimeType?: string,
    messageType?: MessageType,
): FileCategory {
    if (messageType === "VIDEO") return "video";

    // Ưu tiên extension trước, sau đó mới fallback sang mimeType.
    const ext = getFileExtension(fileName);
    if (VIDEO_FILE_EXTENSIONS.has(ext)) return "video";
    if (ext === "pdf") return "pdf";
    if (WORD_FILE_EXTENSIONS.has(ext)) return "word";
    if (EXCEL_FILE_EXTENSIONS.has(ext)) return "excel";
    if (PPT_FILE_EXTENSIONS.has(ext)) return "ppt";

    const normalizedMime = normalizeMimeType(mimeType);
    if (!normalizedMime) return "other";

    if (normalizedMime.startsWith("video/")) return "video";
    if (normalizedMime === "application/pdf") return "pdf";
    if (WORD_MIME_TYPES.has(normalizedMime)) return "word";
    if (EXCEL_MIME_TYPES.has(normalizedMime)) return "excel";
    if (PPT_MIME_TYPES.has(normalizedMime)) return "ppt";

    return "other";
}

function getFileTypeBadge(fileCategory: FileCategory): string | null {
    if (fileCategory === "pdf") return "PDF";
    if (fileCategory === "word") return "WORD";
    if (fileCategory === "excel") return "EXCEL";
    if (fileCategory === "ppt") return "PPT";
    if (fileCategory === "video") return "VIDEO";
    return null;
}

function isDocumentCategory(fileCategory: FileCategory): boolean {
    return fileCategory === "pdf" || fileCategory === "word";
}

function getFileTypePalette(fileCategory: FileCategory) {
    if (fileCategory === "pdf") {
        return {
            iconBg: "bg-red-100 dark:bg-red-950",
            iconText: "text-red-600 dark:text-red-300",
            badgeBg: "bg-red-100 dark:bg-red-950",
            badgeText: "text-red-700 dark:text-red-200",
        };
    }
    if (fileCategory === "word") {
        return {
            iconBg: "bg-blue-100 dark:bg-blue-950",
            iconText: "text-blue-600 dark:text-blue-300",
            badgeBg: "bg-blue-100 dark:bg-blue-950",
            badgeText: "text-blue-700 dark:text-blue-200",
        };
    }
    if (fileCategory === "excel") {
        return {
            iconBg: "bg-emerald-100 dark:bg-emerald-950",
            iconText: "text-emerald-600 dark:text-emerald-300",
            badgeBg: "bg-emerald-100 dark:bg-emerald-950",
            badgeText: "text-emerald-700 dark:text-emerald-200",
        };
    }
    if (fileCategory === "ppt") {
        return {
            iconBg: "bg-orange-100 dark:bg-orange-950",
            iconText: "text-orange-600 dark:text-orange-300",
            badgeBg: "bg-orange-100 dark:bg-orange-950",
            badgeText: "text-orange-700 dark:text-orange-200",
        };
    }
    if (fileCategory === "video") {
        return {
            iconBg: "bg-sky-100 dark:bg-sky-950",
            iconText: "text-sky-600 dark:text-sky-300",
            badgeBg: "bg-sky-100 dark:bg-sky-950",
            badgeText: "text-sky-700 dark:text-sky-200",
        };
    }

    return {
        iconBg: "bg-gray-200 dark:bg-gray-700",
        iconText: "text-gray-600 dark:text-gray-300",
        badgeBg: "bg-gray-200 dark:bg-gray-700",
        badgeText: "text-gray-700 dark:text-gray-200",
    };
}

function resolveLocalAvailabilityLabel(
    attachment?: MessageAttachment,
): string | null {
    if (!attachment) return null;
    const metadata = attachment as MessageAttachment & Record<string, unknown>;

    const localBooleanKeys = [
        "isLocal",
        "existsOnDevice",
        "availableOnDevice",
        "isAvailableOnDevice",
        "downloaded",
    ];
    if (localBooleanKeys.some((key) => metadata[key] === true)) {
        return "Đã có trên máy";
    }

    const localStringKeys = ["localStatus", "status", "deviceStatus"];
    const localStatusRaw = localStringKeys
        .map((key) => metadata[key])
        .find((value): value is string => typeof value === "string");

    if (!localStatusRaw) return null;

    const normalized = localStatusRaw.trim().toLowerCase();
    if (!normalized) return null;

    if (
        normalized.includes("đã có trên máy") ||
        normalized.includes("local") ||
        normalized.includes("available") ||
        normalized.includes("downloaded") ||
        normalized.includes("device")
    ) {
        return "Đã có trên máy";
    }

    return null;
}

function resolveVideoPosterUrl(
    attachment?: MessageAttachment,
): string | undefined {
    if (!attachment) return undefined;
    const metadata = attachment as MessageAttachment & Record<string, unknown>;
    const posterKeys = ["thumbnailUrl", "thumbnail", "posterUrl", "poster"];

    for (const key of posterKeys) {
        const value = metadata[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    return undefined;
}

/* ─── Custom Audio Player (UI phát audio tin nhắn thoại) ─────────────────── */

/**
 * AudioPlayer - Component tùy chỉnh để phát audio tin nhắn thoại
 *
 * Giao diện bao gồm:
 * - Nút Play/Pause tròn
 * - Waveform bars (fake, seeded theo URL để nhất quán)
 * - Thời gian hiện tại / tổng thời lượng
 *
 * Tính năng:
 * - Click waveform để seek (tua)
 * - Tự động reset về 0 khi audio kết thúc
 * - Màu sắc thay đổi theo isOwn (tin của mình vs tin người khác)
 */
function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
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
            return 15 + (Math.abs(seeded) % 70); // 15–85 %
        });
    }, [src]);

    // Toggle play/pause
    const togglePlay = useCallback(() => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) a.pause();
        else void a.play();
    }, [playing]);

    // Xử lý seek - click vào waveform để tua đến vị trí đó
    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const a = audioRef.current;
        if (!a || !a.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        // Tính % vị trí click → tua audio đến % đó
        a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
    }, []);

    // Phần trăm đã phát (để tô màu waveform bars)
    const progress = duration > 0 ? currentTime / duration : 0;

    // Format thời gian: "M:SS"
    const fmt = (s: number) => {
        const m = Math.floor(s / 60);
        return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    };

    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 w-full min-w-55">
            {/* Audio element ẩn - điều khiển qua ref */}
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    setCurrentTime(0); // Reset về đầu khi kết thúc
                }}
                onTimeUpdate={() =>
                    setCurrentTime(audioRef.current?.currentTime ?? 0)
                }
                onLoadedMetadata={() =>
                    setDuration(audioRef.current?.duration ?? 0)
                }
            />

            {/* Nút Play / Pause tròn */}
            <button
                type="button"
                onClick={togglePlay}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isOwn
                        ? "bg-white/20 hover:bg-white/30 text-white" // Tin của mình: trắng mờ trên nền xanh
                        : "bg-gray-900 hover:bg-gray-700 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900" // Tin người khác: đen (light) / trắng (dark)
                }`}
            >
                {playing ? (
                    <Pause size={16} fill="currentColor" />
                ) : (
                    <Play size={16} fill="currentColor" />
                )}
            </button>

            {/* Waveform bars - click để seek */}
            <div
                className="flex-1 flex items-center gap-0.5 h-8 cursor-pointer"
                onClick={handleSeek}
            >
                {bars.map((h, i) => {
                    // Cột này đã phát chưa (dựa vào progress)
                    const played = i / bars.length <= progress;
                    return (
                        <div
                            key={i}
                            className={`rounded-full flex-1 transition-colors ${
                                played
                                    ? isOwn
                                        ? "bg-white" // Đã phát - tin của mình: trắng
                                        : "bg-gray-900 dark:bg-gray-100" // Đã phát - tin người khác: đen/trắng
                                    : isOwn
                                      ? "bg-white/35" // Chưa phát - tin của mình: trắng mờ
                                      : "bg-gray-300 dark:bg-gray-500" // Chưa phát - tin người khác: xám
                            }`}
                            style={{ height: `${h}%` }}
                        />
                    );
                })}
            </div>

            {/* Hiển thị thời gian: currentTime nếu đang phát, duration nếu chưa phát */}
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

/* ─── MessageBubble ────────────────────────────────────────────────────────── */

export interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    senderName: string;
    senderAvatar?: string;
    replyPreview?: {
        messageId: string;
        senderId?: number;
        senderName: string;
        content: string;
        type?: MessageType;
        fileName?: string;
        mimeType?: string;
        thumbnailUrl?: string;
        posterUrl?: string;
    } | null;
    conversationType?: "DIRECT" | "GROUP";
    defaultAvatarSmallUrl: string;
    isPinned?: boolean;
    onPin: (messageId: string) => void;
    onUnpin: (messageId: string) => void;
    onReply: (message: Message) => void;
    onJumpToMessage?: (messageId: string) => void;
    onRecall: (messageId: string) => void;
    onRecallCall?: (callType: "audio" | "video") => void;
    onDeleteForMe: (messageId: string) => void;
    onMediaLoad?: () => void;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    isHighlighted?: boolean;
    currentUserId: number;
}

export function MessageBubble({
    message,
    isOwn,
    senderName,
    senderAvatar,
    replyPreview,
    conversationType,
    defaultAvatarSmallUrl,
    isPinned = false,
    onPin,
    onUnpin,
    onReply,
    onJumpToMessage,
    onRecall,
    onRecallCall,
    onDeleteForMe,
    onMediaLoad,
    isFirstInGroup = true,
    isLastInGroup = true,
    isHighlighted = false,
    currentUserId,
}: MessageBubbleProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        function handleOutside(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [menuOpen]);

    const handleCopy = useCallback(() => {
        if (message.content) navigator.clipboard.writeText(message.content);
        setMenuOpen(false);
    }, [message.content]);

    const handleRecallClick = useCallback(() => {
        onRecall(message.id);
        setMenuOpen(false);
    }, [message.id, onRecall]);

    const handlePinClick = useCallback(() => {
        if (isPinned) {
            onUnpin(message.id);
        } else {
            onPin(message.id);
        }
        setMenuOpen(false);
    }, [message.id, onPin, onUnpin, isPinned]);

    const handleReplyClick = useCallback(() => {
        onReply(message);
        setMenuOpen(false);
    }, [message, onReply]);

    const handleDeleteForMeClick = useCallback(() => {
        onDeleteForMe(message.id);
        setMenuOpen(false);
    }, [message.id, onDeleteForMe]);

    // Tính toán text hiển thị phần reply theo logic Facebook Messenger
    const getReplyLabel = useCallback(() => {
        if (!replyPreview) return "";
        const repliedMessageSenderId = replyPreview.senderId;
        const currentMessageSenderId = message.senderId;
        if (currentMessageSenderId === repliedMessageSenderId) {
            if (currentUserId === currentMessageSenderId) {
                return "Bạn đã trả lời chính mình";
            } else {
                return `${senderName} đã trả lời chính mình`;
            }
        } else {
            if (currentUserId === currentMessageSenderId) {
                return `Bạn đã trả lời tin nhắn của ${replyPreview.senderName}`;
            } else if (currentUserId === repliedMessageSenderId) {
                return `${senderName} đã trả lời tin nhắn của bạn`;
            } else {
                return `${senderName} đã trả lời tin nhắn của ${replyPreview.senderName}`;
            }
        }
    }, [replyPreview, message.senderId, currentUserId, senderName]);

    const menuItemBase =
        "flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";
    // Tính toán text hiển thị phần reply theo logic Facebook Messenger
    // Nhận diện các tin nhắn hệ thống liên quan đến ghim/bỏ ghim.
    // Các tin này sẽ render ở giữa đoạn chat (không lệch trái/phải như bubble thường).
    const isPinSystemMessage =
        message.type === "SYSTEM_PIN" || message.type === "SYSTEM_UPIN";

    const messageDate = new Date(message.createdAt);
    const validMessageDate = Number.isFinite(messageDate.getTime());
    const timeStr = validMessageDate
        ? messageDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "";

    // Tooltip giờ có ngữ cảnh: hôm nay → giờ, hôm qua → "Hôm qua HH:MM", cũ → "D Tháng M, YYYY HH:MM"
    const tooltipTimeStr = (() => {
        const date = new Date(message.createdAt);
        if (!Number.isFinite(date.getTime())) return "";
        const now = new Date();
        const diffDays = Math.round(
            (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
                Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
                86400000,
        );
        if (diffDays === 0) return timeStr;
        if (diffDays === 1) return `Hôm qua ${timeStr}`;
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const y = date.getFullYear();
        return y === now.getFullYear()
            ? `${d} Tháng ${m}, ${timeStr}`
            : `${d} Tháng ${m}, ${y} ${timeStr}`;
    })();

    const fileNameFromUrl = getFileNameFromUrl(message.content, "Tệp đính kèm");
    const messageAttachments = Array.isArray(message.attachments)
        ? message.attachments
        : [];
    const imageUrls =
        message.type === "IMAGE"
            ? messageAttachments
                  .map((attachment) => attachment.url)
                  .filter((url): url is string => Boolean(url))
            : [];
    const videoUrls =
        message.type === "VIDEO"
            ? messageAttachments
                  .map((attachment) => attachment.url)
                  .filter((url): url is string => Boolean(url))
            : [];
    const audioUrls =
        message.type === "AUDIO"
            ? messageAttachments
                  .map((attachment) => attachment.url)
                  .filter((url): url is string => Boolean(url))
            : [];
    const fileAttachment =
        message.type === "FILE" || message.type === "VIDEO"
            ? messageAttachments[0]
            : undefined;
    const resolvedFileName =
        fileAttachment?.fileName ||
        getFileNameFromUrl(fileAttachment?.url, fileNameFromUrl);
    const resolvedFileUrl = fileAttachment?.url || message.content;
    const resolvedFileSize = formatBytes(fileAttachment?.fileSize);
    const resolvedFileMimeType = fileAttachment?.type;
    const resolvedFileCategory = resolveFileCategory(
        resolvedFileName,
        resolvedFileMimeType,
        message.type,
    );
    const resolvedFilePalette = getFileTypePalette(resolvedFileCategory);
    const resolvedFileBadge = getFileTypeBadge(resolvedFileCategory);
    const resolvedLocalAvailabilityLabel =
        resolveLocalAvailabilityLabel(fileAttachment);
    const resolvedVideoPoster = resolveVideoPosterUrl(fileAttachment);
    const isVideoFileBubble =
        (message.type === "FILE" || message.type === "VIDEO") &&
        resolvedFileCategory === "video";
    const isDocumentFileBubble = isDocumentCategory(resolvedFileCategory);
    const isFileMessageBubble = message.type === "FILE" || isVideoFileBubble;
    const fileIconLabel =
        resolvedFileCategory === "word"
            ? "W"
            : resolvedFileCategory === "pdf"
              ? "PDF"
              : null;
    const resolvedSecondaryMeta = [
        resolvedFileSize,
        resolvedLocalAvailabilityLabel,
    ]
        .filter(Boolean)
        .join("  ");
    const resolvedSizeLabel = resolvedFileSize || "Không rõ dung lượng";
    const fileActionButtonClass =
        "h-9 w-9 shrink-0 rounded-md border border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-700";

    const handleOpenFile = useCallback(() => {
        if (!resolvedFileUrl) return;
        window.open(resolvedFileUrl, "_blank", "noopener,noreferrer");
    }, [resolvedFileUrl]);

    const handleDownloadFile = useCallback(() => {
        if (!resolvedFileUrl) return;

        const anchor = document.createElement("a");
        anchor.href = resolvedFileUrl;
        anchor.download = resolvedFileName || "download";
        anchor.rel = "noopener noreferrer";
        anchor.target = "_blank";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }, [resolvedFileName, resolvedFileUrl]);

    const handleFileCardKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!resolvedFileUrl) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            handleOpenFile();
        },
        [handleOpenFile, resolvedFileUrl],
    );

    // Chuẩn hoá nội dung preview cho tin hệ thống ghim,
    // giúp hiện kiểu: "Bạn ghim 1 tin nhắn file meals.zip" giống mẫu UI mong muốn.
    const pinnedTargetPreview = useMemo(() => {
        if (!message.replyInfo) return "1 tin nhắn";

        if (message.replyInfo.type === "IMAGE") {
            return "1 tin nhắn ảnh";
        }
        if (message.replyInfo.type === "VIDEO") {
            return "1 tin nhắn video";
        }
        if (message.replyInfo.type === "AUDIO") {
            return "1 tin nhắn thoại";
        }
        if (message.replyInfo.type === "FILE") {
            return `file ${getFileNameFromUrl(message.replyInfo.content)}`;
        }

        const raw = (message.replyInfo.content || "").trim();
        if (!raw) return "1 tin nhắn";
        return `"${raw}"`;
    }, [message.replyInfo]);

    const callMeta = useMemo(() => {
        if (message.type !== "CALL") return null;

        const formatDuration = (seconds: number) => {
            const total = Math.max(0, seconds);
            if (total < 60) return `${total} giây`;
            const minutes = Math.floor(total / 60);
            const remain = total % 60;
            if (!remain) return `${minutes} phút`;
            return `${minutes} phút ${remain} giây`;
        };

        try {
            const parsed = JSON.parse(message.content) as {
                callType?: "audio" | "video";
                status?:
                    | "calling"
                    | "ringing"
                    | "accepted"
                    | "rejected"
                    | "ended";
                durationSeconds?: number;
            };

            const callType: "audio" | "video" =
                parsed.callType === "video" ? "video" : "audio";
            const duration = Math.max(0, Number(parsed.durationSeconds ?? 0));
            const status = parsed.status;
            const isMissed =
                duration === 0 &&
                (status === "rejected" ||
                    status === "ringing" ||
                    status === "calling" ||
                    status === "ended");

            const baseLabel =
                callType === "video" ? "cuộc gọi video" : "cuộc gọi thoại";

            return {
                callType,
                isMissed,
                title: isMissed
                    ? `Đã bỏ lỡ ${baseLabel}`
                    : callType === "video"
                      ? "Cuộc gọi video"
                      : "Cuộc gọi thoại",
                subtitle: isMissed ? timeStr : formatDuration(duration),
            };
        } catch {
            const inferredType: "audio" | "video" = message.content
                .toLowerCase()
                .includes("video")
                ? "video"
                : "audio";
            return {
                callType: inferredType,
                isMissed: false,
                title:
                    inferredType === "video"
                        ? "Cuộc gọi video"
                        : "Cuộc gọi thoại",
                subtitle: timeStr,
            };
        }
    }, [message.content, message.type, timeStr]);

    const timeColorInside = message.isRecalled
        ? "text-gray-400 dark:text-gray-500"
        : isOwn
          ? "text-blue-100"
          : "text-gray-500 dark:text-gray-400";

    // Metadata cho tin nhắn bên người gửi:
    // - Bubble luôn hiển thị phía trên
    // - Dòng avatar + tên + thời gian nằm dưới bubble để dễ đọc hơn
    const showIncomingMetaRow = !isOwn && !message.isRecalled && isLastInGroup;
    const incomingMetaSpacingClass = isFirstInGroup ? "mt-1.5" : "mt-1";
    const incomingNameWeightClass =
        conversationType === "GROUP" ? "font-semibold" : "font-medium";

    const normalizedReplyContent = (replyPreview?.content ?? "").trim();
    const isReplyPreviewRecalled =
        Boolean(replyPreview) &&
        (normalizedReplyContent.length === 0 ||
            normalizedReplyContent === "Tin nhắn đã được thu hồi");
    const parsedReplyContent = useMemo(
        () => parseReplyContent(replyPreview?.content),
        [replyPreview?.content],
    );

    const rawReplyMediaSourceUrl = (
        parsedReplyContent.sourceUrl ||
        replyPreview?.content ||
        ""
    ).trim();
    const replyMediaSourceUrl = isLikelyMediaSource(rawReplyMediaSourceUrl)
        ? rawReplyMediaSourceUrl
        : "";
    const replyMediaFileName =
        replyPreview?.fileName ||
        parsedReplyContent.fileName ||
        getFileNameFromUrl(replyMediaSourceUrl, "");
    const replyMediaMimeType =
        replyPreview?.mimeType || parsedReplyContent.mimeType;
    const isReplyAudioPreview =
        !isReplyPreviewRecalled &&
        (replyPreview?.type === "AUDIO" ||
            isAudioFile(
                replyMediaFileName || replyMediaSourceUrl,
                replyMediaMimeType,
            ));
    const replyMediaType = getReplyMediaType({
        type: replyPreview?.type,
        content: replyMediaSourceUrl,
        fileName: replyMediaFileName,
        mimeType: replyMediaMimeType,
    });
    const replyMediaThumbnailUrl =
        replyMediaType === "image"
            ? (
                  replyPreview?.thumbnailUrl ||
                  parsedReplyContent.thumbnailUrl ||
                  replyMediaSourceUrl
              ).trim()
            : replyMediaType === "video"
              ? (
                    replyPreview?.thumbnailUrl ||
                    replyPreview?.posterUrl ||
                    parsedReplyContent.thumbnailUrl ||
                    parsedReplyContent.posterUrl ||
                    (isImageFile(replyMediaSourceUrl, replyMediaMimeType)
                        ? replyMediaSourceUrl
                        : "")
                ).trim()
              : "";
    const replyVideoPosterUrl = (
        replyPreview?.posterUrl ||
        parsedReplyContent.posterUrl ||
        ""
    ).trim();

    const [replyMediaThumbnailFailed, setReplyMediaThumbnailFailed] =
        useState(false);

    useEffect(() => {
        setReplyMediaThumbnailFailed(false);
    }, [replyPreview?.messageId, replyMediaThumbnailUrl]);

    const replyPreviewText = useMemo(() => {
        if (!replyPreview || isReplyPreviewRecalled) {
            return "Tin nhắn đã được thu hồi";
        }

        if (replyMediaType === "image" || replyMediaType === "video") {
            const candidateText = (
                parsedReplyContent.text || normalizedReplyContent
            ).trim();
            if (!candidateText || isLikelyMediaSource(candidateText)) {
                return "";
            }
            return candidateText;
        }

        if (isReplyAudioPreview) return "Tin nhắn thoại";

        if (replyPreview.type === "FILE") {
            return (
                replyPreview.fileName ||
                parsedReplyContent.fileName ||
                getFileNameFromUrl(replyPreview.content, "Tệp đính kèm")
            );
        }

        if (replyPreview.type === "CALL") return "Cuộc gọi";
        return replyPreview.content;
    }, [
        isReplyAudioPreview,
        isReplyPreviewRecalled,
        normalizedReplyContent,
        parsedReplyContent.fileName,
        parsedReplyContent.text,
        replyMediaType,
        replyPreview,
    ]);

    const hasReplyMediaThumbnail =
        !isReplyPreviewRecalled &&
        (replyMediaType === "image" || replyMediaType === "video");
    const highlightedBubbleClass = isHighlighted
        ? "border-2 border-blue-500 dark:border-blue-400 ring-2 ring-blue-400/40 dark:ring-blue-400/35 ring-offset-2 ring-offset-transparent shadow-sm scale-[1.01]"
        : "";

    // Render riêng cho tin hệ thống ghim/bỏ ghim:
    // - Canh giữa toàn bộ đoạn chat
    // - Có icon ghim
    // - Có nút "Xem" để nhảy đến tin gốc (nếu có replyInfo.messageId)
    if (isPinSystemMessage) {
        const actorLabel = isOwn ? "Bạn" : senderName;
        const actionLabel = message.type === "SYSTEM_UPIN" ? "bỏ ghim" : "ghim";

        return (
            <div className="w-full flex justify-center">
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200">
                    <Pin size={12} className="shrink-0" />
                    <span className="truncate">
                        {actorLabel} {actionLabel} {pinnedTargetPreview}
                    </span>
                    {message.type === "SYSTEM_PIN" &&
                        message.replyInfo?.messageId && (
                            <button
                                type="button"
                                onClick={() =>
                                    onJumpToMessage?.(
                                        message.replyInfo!.messageId,
                                    )
                                }
                                className="shrink-0 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                            >
                                Xem
                            </button>
                        )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-end gap-1 overflow-visible ${isOwn ? "justify-end" : "justify-start"} group`}
        >
            {/* Nút "..." — hiện khi hover, căn giữa theo bubble */}
            <div
                ref={menuRef}
                className={`relative z-60 opacity-0 group-hover:opacity-100 transition-opacity self-center ${isOwn ? "order-first" : "order-last"}`}
            >
                <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 mb-4"
                    title="Tùy chọn"
                >
                    <MoreVertical size={16} />
                </button>

                {menuOpen && (
                    <div
                        className={`absolute bottom-full mb-1 ${isOwn ? "right-0" : "left-0"} bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl py-1.5 z-70 w-56`}
                    >
                        {message.isRecalled ? (
                            <button
                                onClick={handleDeleteForMeClick}
                                className={menuItemBase}
                            >
                                <Trash2
                                    size={16}
                                    className="text-red-500 shrink-0"
                                />
                                <span className="text-red-500">
                                    Xóa chỉ ở phía tôi
                                </span>
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleCopy}
                                    className={menuItemBase}
                                >
                                    <Copy
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400 shrink-0"
                                    />
                                    <span className="text-gray-800 dark:text-gray-100">
                                        Copy tin nhắn
                                    </span>
                                </button>
                                <button
                                    onClick={handlePinClick}
                                    className={menuItemBase}
                                >
                                    <Pin
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400 shrink-0"
                                    />
                                    <span className="text-gray-800 dark:text-gray-100">
                                        {isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                                    </span>
                                </button>
                                <button
                                    onClick={handleReplyClick}
                                    className={menuItemBase}
                                >
                                    <Reply
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400 shrink-0"
                                    />
                                    <span className="text-gray-800 dark:text-gray-100">
                                        Trả lời
                                    </span>
                                </button>
                                <button
                                    onClick={() => setMenuOpen(false)}
                                    className={menuItemBase}
                                >
                                    <Star
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400 shrink-0"
                                    />
                                    <span className="text-gray-800 dark:text-gray-100">
                                        Đánh dấu tin nhắn
                                    </span>
                                </button>
                                <button
                                    onClick={() => setMenuOpen(false)}
                                    className={menuItemBase}
                                >
                                    <ListChecks
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400 shrink-0"
                                    />
                                    <span className="text-gray-800 dark:text-gray-100">
                                        Chọn nhiều tin nhắn
                                    </span>
                                </button>
                                <button
                                    onClick={() => setMenuOpen(false)}
                                    className={menuItemBase}
                                >
                                    <Info
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400 shrink-0"
                                    />
                                    <span className="text-gray-800 dark:text-gray-100">
                                        Xem chi tiết
                                    </span>
                                </button>
                                <button
                                    onClick={() => setMenuOpen(false)}
                                    className={`${menuItemBase} justify-between`}
                                >
                                    <span className="flex items-center gap-3">
                                        <ChevronRight
                                            size={16}
                                            className="text-gray-500 dark:text-gray-400 shrink-0"
                                        />
                                        <span className="text-gray-800 dark:text-gray-100">
                                            Tuỳ chọn khác
                                        </span>
                                    </span>
                                    <ChevronRight
                                        size={14}
                                        className="text-gray-400"
                                    />
                                </button>

                                {/* Separator + Danger zone */}
                                <div className="my-1.5 border-t border-gray-100 dark:border-gray-700" />

                                {/* Thu hồi - chỉ hiện cho tin nhắn của mình */}
                                {isOwn && (
                                    <button
                                        onClick={handleRecallClick}
                                        className={menuItemBase}
                                    >
                                        <Undo2
                                            size={16}
                                            className="text-red-500 shrink-0"
                                        />
                                        <span className="text-red-500">
                                            Thu hồi
                                        </span>
                                    </button>
                                )}

                                {/* Xóa ở phía tôi - hiện cho TẤT CẢ tin nhắn */}
                                <button
                                    onClick={handleDeleteForMeClick}
                                    className={menuItemBase}
                                >
                                    <Trash2
                                        size={16}
                                        className="text-red-500 shrink-0"
                                    />
                                    <span className="text-red-500">
                                        Xóa chỉ ở phía tôi
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Cột: bubble + metadata dưới (với tin người gửi) */}
            <div
                className={`relative flex flex-col max-w-[70%] overflow-visible ${isOwn ? "items-end" : "items-start"}`}
            >
                {/* Bubble hoặc Emoji-only */}
                {message.type === "TEXT" &&
                !message.isRecalled &&
                isEmojiOnly(message.content) ? (
                    // Emoji-only: không có background, text lớn
                    <p className="text-4xl leading-tight px-1">
                        {message.content}
                    </p>
                ) : (
                    // Bubble bình thường với background
                    <>
                        {/* Label 'Đã trả lời' ở ngoài bubble */}
                        {!!replyPreview && !message.isRecalled && (
                            <p className="text-[10px] font-normal text-gray-400 dark:text-gray-500 px-1 mb-1">
                                {getReplyLabel()}
                            </p>
                        )}

                        <div
                            className={`relative flex flex-col ${
                                isOwn ? "items-end" : "items-start"
                            }`}
                        >
                            {!!replyPreview && !message.isRecalled && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onJumpToMessage?.(
                                            replyPreview.messageId,
                                        )
                                    }
                                    className={`inline-flex max-w-[19.5rem] items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-gray-800 dark:text-gray-100 transition-colors ${
                                        hasReplyMediaThumbnail
                                            ? "bg-transparent ring-0 hover:bg-transparent"
                                            : "ring-1 ring-gray-200/40 dark:ring-gray-700/40 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-200"
                                    }`}
                                >
                                    {hasReplyMediaThumbnail ? (
                                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                                            {replyMediaType === "image" ? (
                                                replyMediaThumbnailUrl &&
                                                !replyMediaThumbnailFailed ? (
                                                    <img
                                                        src={
                                                            replyMediaThumbnailUrl
                                                        }
                                                        alt="Reply media"
                                                        className="h-full w-full object-cover"
                                                        onError={() =>
                                                            setReplyMediaThumbnailFailed(
                                                                true,
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <span className="absolute inset-0 flex items-center justify-center bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                                        <ImageIcon size={18} />
                                                    </span>
                                                )
                                            ) : (
                                                <>
                                                    {replyMediaThumbnailUrl &&
                                                    !replyMediaThumbnailFailed ? (
                                                        <img
                                                            src={
                                                                replyMediaThumbnailUrl
                                                            }
                                                            alt="Reply video"
                                                            className="h-full w-full object-cover"
                                                            onError={() =>
                                                                setReplyMediaThumbnailFailed(
                                                                    true,
                                                                )
                                                            }
                                                        />
                                                    ) : replyMediaSourceUrl &&
                                                      !replyMediaThumbnailFailed ? (
                                                        <video
                                                            src={
                                                                replyMediaSourceUrl
                                                            }
                                                            poster={
                                                                replyVideoPosterUrl ||
                                                                undefined
                                                            }
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                            className="h-full w-full object-cover pointer-events-none"
                                                            onError={() =>
                                                                setReplyMediaThumbnailFailed(
                                                                    true,
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <span className="absolute inset-0 bg-black/70" />
                                                    )}
                                                    <span className="absolute inset-0 flex items-center justify-center">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
                                                            <Play
                                                                size={14}
                                                                className="fill-white text-white ml-0.5"
                                                            />
                                                        </span>
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    ) : !isReplyPreviewRecalled &&
                                      isReplyAudioPreview ? (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                            <Mic size={18} />
                                        </span>
                                    ) : !isReplyPreviewRecalled &&
                                      replyPreview.type === "CALL" ? (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-300/50 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                            <Phone size={18} />
                                        </span>
                                    ) : !isReplyPreviewRecalled &&
                                      replyPreview.type === "FILE" ? (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-300/50 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                            <Paperclip size={16} />
                                        </span>
                                    ) : null}

                                    <div className="min-w-0 flex-1 text-left">
                                        <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-100">
                                            {/* {replyPreview.senderName} */}
                                        </p>
                                        {replyPreviewText && (
                                            <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-300 mb-1">
                                                {replyPreviewText}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            )}

                            <div
                                className={`w-fit max-w-full overflow-hidden rounded-2xl ${
                                    replyPreview && !message.isRecalled
                                        ? "relative z-10 -mt-3"
                                        : ""
                                } ${
                                    message.isRecalled
                                        ? "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                        : message.type === "IMAGE"
                                          ? "bg-transparent text-black dark:text-white"
                                          : message.type === "VIDEO"
                                            ? "bg-transparent text-black dark:text-white"
                                            : message.type === "FILE"
                                              ? "bg-transparent text-black dark:text-white"
                                              : isOwn
                                                ? "bg-blue-500 text-white"
                                                : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                                } transition-all duration-300 ${highlightedBubbleClass}`}
                            >
                                {message.isRecalled ? (
                                    <>
                                        <p className="px-4 py-2 text-sm italic text-gray-400 dark:text-gray-500">
                                            Tin nhắn đã được thu hồi
                                        </p>
                                        {isLastInGroup && (
                                            <p
                                                className={`px-3 pb-1.5 text-xs text-right ${timeColorInside}`}
                                            >
                                                {timeStr}
                                            </p>
                                        )}
                                    </>
                                ) : message.type === "IMAGE" ? (
                                    imageUrls.length > 0 ? (
                                        <div
                                            className={`grid gap-1 w-64 sm:w-72 md:w-76 ${
                                                imageUrls.length === 1
                                                    ? "grid-cols-1"
                                                    : imageUrls.length === 2
                                                      ? "grid-cols-2"
                                                      : "grid-cols-3"
                                            }`}
                                        >
                                            {imageUrls
                                                .slice(0, 6)
                                                .map((url, index, limited) => {
                                                    const remain =
                                                        imageUrls.length -
                                                        limited.length;
                                                    return (
                                                        <button
                                                            key={`${url}-${index}`}
                                                            type="button"
                                                            className={`relative overflow-hidden cursor-zoom-in ${
                                                                imageUrls.length ===
                                                                1
                                                                    ? "h-72 md:h-80 rounded-2xl"
                                                                    : "aspect-square rounded-xl"
                                                            }`}
                                                            onClick={() =>
                                                                window.open(
                                                                    url,
                                                                    "_blank",
                                                                )
                                                            }
                                                        >
                                                            <img
                                                                src={url}
                                                                alt="Hình ảnh"
                                                                className="h-full w-full object-cover"
                                                                onLoad={
                                                                    onMediaLoad
                                                                }
                                                            />
                                                            {remain > 0 &&
                                                                index ===
                                                                    limited.length -
                                                                        1 && (
                                                                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-lg font-semibold">
                                                                        +
                                                                        {remain}
                                                                    </span>
                                                                )}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="block w-64 sm:w-72 md:w-76 h-72 md:h-80 cursor-zoom-in"
                                            onClick={() =>
                                                window.open(
                                                    message.content,
                                                    "_blank",
                                                )
                                            }
                                        >
                                            <img
                                                src={message.content}
                                                alt="Hình ảnh"
                                                className="h-full w-full object-cover"
                                                onLoad={onMediaLoad}
                                            />
                                        </button>
                                    )
                                ) : isVideoFileBubble ? (
                                    <div className="w-[18.75rem] max-w-[78vw] sm:w-[20rem] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                                        <div className="bg-black">
                                            <video
                                                src={resolvedFileUrl}
                                                poster={resolvedVideoPoster}
                                                controls
                                                preload="metadata"
                                                className="block w-full max-h-60 bg-black object-contain"
                                                onLoadedData={onMediaLoad}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2.5 border-t border-gray-200 dark:border-black bg-gray-50 dark:bg-gray-900 px-3 py-2.5">
                                            <span
                                                className={`h-10 w-10 shrink-0 rounded-xl ${resolvedFilePalette.iconBg} flex items-center justify-center`}
                                            >
                                                <FileVideoCamera
                                                    size={18}
                                                    className={
                                                        resolvedFilePalette.iconText
                                                    }
                                                />
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                    {resolvedFileName}
                                                </span>
                                                <span className="block mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                    {resolvedSecondaryMeta ||
                                                        "Tệp video"}
                                                </span>
                                                {timeStr && (
                                                    <span className="block mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                                                        {timeStr}
                                                    </span>
                                                )}
                                            </span>

                                            <span className="flex items-center gap-1.5 shrink-0 self-center">
                                                <button
                                                    type="button"
                                                    title="Mở file"
                                                    onClick={handleOpenFile}
                                                    className={
                                                        fileActionButtonClass
                                                    }
                                                >
                                                    <FolderOpen size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Tải xuống"
                                                    onClick={handleDownloadFile}
                                                    className={
                                                        fileActionButtonClass
                                                    }
                                                >
                                                    <Download size={15} />
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                ) : message.type === "AUDIO" ? (
                                    <AudioPlayer
                                        src={audioUrls[0] || message.content}
                                        isOwn={isOwn}
                                    />
                                ) : message.type === "FILE" ? (
                                    <div
                                        role={
                                            resolvedFileUrl
                                                ? "button"
                                                : undefined
                                        }
                                        tabIndex={resolvedFileUrl ? 0 : -1}
                                        onClick={
                                            resolvedFileUrl
                                                ? handleOpenFile
                                                : undefined
                                        }
                                        onKeyDown={handleFileCardKeyDown}
                                        className={`w-[18.75rem] max-w-[78vw] sm:w-[20rem] rounded-2xl border border-gray-200 dark:border-[#303030] px-3 py-2.5 shadow-sm transition-colors ${
                                            resolvedFileUrl
                                                ? "cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
                                                : "bg-gray-50 dark:bg-gray-900"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span
                                                className={`h-11 w-11 shrink-0 rounded-lg ${resolvedFilePalette.iconBg} flex items-center justify-center`}
                                            >
                                                {fileIconLabel ? (
                                                    <span
                                                        className={`${resolvedFilePalette.iconText} font-bold leading-none ${
                                                            fileIconLabel ===
                                                            "PDF"
                                                                ? "text-[10px] tracking-wide"
                                                                : "text-lg"
                                                        }`}
                                                    >
                                                        {fileIconLabel}
                                                    </span>
                                                ) : resolvedFileCategory ===
                                                  "excel" ? (
                                                    <FileSpreadsheet
                                                        size={18}
                                                        className={
                                                            resolvedFilePalette.iconText
                                                        }
                                                    />
                                                ) : resolvedFileCategory ===
                                                  "ppt" ? (
                                                    <Presentation
                                                        size={18}
                                                        className={
                                                            resolvedFilePalette.iconText
                                                        }
                                                    />
                                                ) : resolvedFileCategory ===
                                                  "video" ? (
                                                    <FileVideoCamera
                                                        size={18}
                                                        className={
                                                            resolvedFilePalette.iconText
                                                        }
                                                    />
                                                ) : resolvedFileCategory ===
                                                      "pdf" ||
                                                  resolvedFileCategory ===
                                                      "word" ? (
                                                    <FileText
                                                        size={18}
                                                        className={
                                                            resolvedFilePalette.iconText
                                                        }
                                                    />
                                                ) : (
                                                    <File
                                                        size={18}
                                                        className={
                                                            resolvedFilePalette.iconText
                                                        }
                                                    />
                                                )}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        {resolvedFileName}
                                                    </span>
                                                    {resolvedFileBadge &&
                                                        !isDocumentFileBubble && (
                                                            <span
                                                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${resolvedFilePalette.badgeBg} ${resolvedFilePalette.badgeText}`}
                                                            >
                                                                {
                                                                    resolvedFileBadge
                                                                }
                                                            </span>
                                                        )}
                                                </span>
                                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>
                                                        {resolvedSizeLabel}
                                                    </span>
                                                    {resolvedLocalAvailabilityLabel && (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                            <CheckCircle2
                                                                size={12}
                                                                className="shrink-0"
                                                            />
                                                            <span>
                                                                {
                                                                    resolvedLocalAvailabilityLabel
                                                                }
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
                                            </span>

                                            <span className="flex items-center gap-1.5 shrink-0 self-center">
                                                <button
                                                    type="button"
                                                    title="Mở file"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleOpenFile();
                                                    }}
                                                    className={
                                                        fileActionButtonClass
                                                    }
                                                >
                                                    <FolderOpen size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Tải xuống"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDownloadFile();
                                                    }}
                                                    className={
                                                        fileActionButtonClass
                                                    }
                                                >
                                                    <Download size={15} />
                                                </button>
                                            </span>
                                        </div>

                                        {timeStr && (
                                            <p className="mt-2 pl-[3.125rem] text-[11px] text-gray-400 dark:text-gray-500">
                                                {timeStr}
                                            </p>
                                        )}
                                    </div>
                                ) : message.type === "CALL" ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            callMeta &&
                                            onRecallCall?.(callMeta.callType)
                                        }
                                        className="w-full px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                        title="Gọi lại"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-9 h-9 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0">
                                                {callMeta?.isMissed ? (
                                                    callMeta.callType ===
                                                    "video" ? (
                                                        <VideoOff
                                                            size={18}
                                                            className="text-gray-900 dark:text-gray-100"
                                                        />
                                                    ) : (
                                                        <PhoneOff
                                                            size={18}
                                                            className="text-gray-900 dark:text-gray-100"
                                                        />
                                                    )
                                                ) : callMeta?.callType ===
                                                  "video" ? (
                                                    <Video
                                                        size={18}
                                                        className="text-gray-900 dark:text-gray-100"
                                                    />
                                                ) : (
                                                    <Phone
                                                        size={18}
                                                        className="text-gray-900 dark:text-gray-100"
                                                    />
                                                )}
                                            </span>

                                            <span className="min-w-0">
                                                <span className="block text-sm leading-5 font-semibold text-gray-900 dark:text-gray-100 wrap-break-word">
                                                    {callMeta?.title}
                                                </span>
                                                <span className="block mt-0.5 text-xs text-gray-900 dark:text-gray-100">
                                                    {callMeta?.subtitle}
                                                </span>
                                            </span>
                                        </div>

                                        <span className="mt-2 block rounded-xl bg-gray-200 dark:bg-gray-700 py-1.5 text-center text-base font-semibold text-gray-900 dark:text-gray-100">
                                            Gọi lại
                                        </span>
                                    </button>
                                ) : (
                                    <p className="px-4 py-1.5 text-sm">
                                        {message.content}
                                    </p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Pin indicator - hiển thị khi tin nhắn đã được ghim */}
                {isPinned && (
                    <div className="flex items-center gap-1 mt-1 px-1">
                        <Pin
                            size={12}
                            className="text-blue-500 shrink-0 text-red-500"
                        />
                        <span className="text-xs text-blue-500 font-medium text-red-500">
                            Đã ghim
                        </span>
                    </div>
                )}

                {/* Metadata dưới bubble cho tin người gửi */}
                {showIncomingMetaRow && (
                    <div
                        className={`flex items-center gap-2 px-1 ${incomingMetaSpacingClass}`}
                    >
                        <img
                            src={senderAvatar || defaultAvatarSmallUrl}
                            alt={senderName}
                            className="h-5 w-5 rounded-full object-cover ring-1 ring-gray-200/80 dark:ring-gray-700/80"
                        />
                        <span
                            className={`max-w-36 truncate text-xs ${incomingNameWeightClass} text-gray-600 dark:text-gray-300`}
                        >
                            {senderName}
                        </span>
                        {timeStr && !isFileMessageBubble && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                {timeStr}
                            </span>
                        )}
                    </div>
                )}

                {/* Giờ dưới bubble cho tin nhắn của mình */}
                {!message.isRecalled &&
                    isLastInGroup &&
                    isOwn &&
                    !isFileMessageBubble && (
                        <p
                            className={`text-xs mt-0.5 px-1 text-gray-400  dark:text-gray-500 ${isOwn ? "self-end" : "self-start"}`}
                        >
                            {timeStr}
                        </p>
                    )}

                {/* Tooltip giờ bên cạnh — hiện khi hover, chỉ tin KHÔNG phải cuối group */}
                {!isLastInGroup && (
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-20 ${
                            isOwn ? "right-full mr-10" : "left-full ml-10"
                        }`}
                    >
                        <span className="text-xs bg-gray-800 dark:bg-gray-900 text-white px-2 py-1 rounded-md shadow-lg">
                            {tooltipTimeStr}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
