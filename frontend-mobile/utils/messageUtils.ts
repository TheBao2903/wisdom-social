import type { Message } from "@/types/chat";

export const MENU_WIDTH = 232;
export const MENU_HORIZONTAL_MARGIN = 12;
export const MENU_VERTICAL_MARGIN = 16;
export const MENU_ESTIMATED_HEIGHT = 390;

export const LOAD_OLDER_TRIGGER_PX = 64;
export const LOAD_NEWER_TRIGGER_PX = 96;
export const STICKY_BOTTOM_THRESHOLD_PX = 16;
export const SHOW_SCROLL_BUTTON_THRESHOLD_PX = 160;
export const RIGHT_SCROLL_CUE_TRIGGER_PX = 120;
export const RIGHT_SCROLL_CUE_HIDE_MS = 1400;
export const RIGHT_SCROLL_CUE_HEIGHT = 60;
export const RIGHT_SCROLL_CUE_MARGIN = 8;
export const JUMP_SCROLL_LOCK_MS = 1500;
export const JUMP_AUTO_PAGING_SUPPRESS_MS = 2600;
export const QUICK_EMOJIS = [
    "😀", "😂", "😍", "🥰", "😘", "😊", "😉", "😎", "😭", "😡",
    "😮", "🤔", "🙏", "👍", "👎", "👏", "🔥", "💯", "🎉", "❤️",
    "💙", "💚", "💛", "🧡", "💜", "🤍", "🤎", "💔", "✨", "🌟",
    "😴", "🤯", "😅", "😇", "🤗", "😋", "🙌", "👌", "🤝", "🎵",
];

export type ContextMenuState = {
    messageId: string;
    top: number;
    left: number;
};

export type ReplyComposerState = {
    id: string;
    senderName: string;
    content: string;
};

export type MediaViewerState = {
    type: "IMAGE" | "VIDEO";
    url: string;
};

export type AudioProgress = {
    positionMillis: number;
    durationMillis: number;
};

export type PinnedBannerItem = {
    messageId: string;
    pinnedAt: string;
    senderName: string;
    preview: string;
    thumbUrl?: string;
};

export type PinSystemRunRenderMeta = {
    runKey: string;
    runLength: number;
    shouldRenderCollapsedButton: boolean;
    shouldHideMessage: boolean;
};

export const contextActions = [
    { key: "copy", label: "Copy tin nhan", icon: "copy-outline" },
    { key: "pin", label: "Ghim tin nhan", icon: "pin-outline" },
    { key: "reply", label: "Tra loi", icon: "return-up-back-outline" },
    { key: "divider-1", divider: true },
    {
        key: "save",
        label: "Danh dau tin nhan",
        icon: "bookmark-outline",
    },
    { key: "divider-2", divider: true },
    {
        key: "select-many",
        label: "Chon nhieu tin nhan",
        icon: "list-outline",
    },
    {
        key: "details",
        label: "Xem chi tiet",
        icon: "information-circle-outline",
    },
    {
        key: "more",
        label: "Tuy chon khac",
        icon: "ellipsis-horizontal-outline",
        hasArrow: true,
    },
    { key: "divider-3", divider: true },
    {
        key: "unsend",
        label: "Thu hoi",
        icon: "arrow-undo-outline",
        destructive: true,
    },
    {
        key: "delete-mine",
        label: "Xoa chi o phia toi",
        icon: "trash-outline",
        destructive: true,
    },
] as const;

export function formatDurationMillis(value: number): string {
    const totalSeconds = Math.max(0, Math.floor(value / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatFileSize(value?: number): string {
    if (!value || value <= 0) return "--";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function resolveMediaUrl(value?: string): string {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value;
}

export function isLikelyStoragePathOrUrl(value?: string): boolean {
    if (!value) return false;
    const normalized = value.trim();
    if (!normalized) return false;
    if (/^https?:\/\//i.test(normalized)) return true;
    return /\.(png|jpg|jpeg|gif|webp|bmp|mp4|mov|mkv|avi|mp3|wav|m4a|pdf|doc|docx|xls|xlsx|zip|rar)$/i.test(
        normalized,
    );
}

export function resolveAttachmentUrls(message: Message): string[] {
    const attachmentUrls = Array.isArray(message.attachments)
        ? message.attachments
              .map((attachment) => resolveMediaUrl(attachment.url))
              .filter(Boolean)
        : [];

    if (attachmentUrls.length > 0) return attachmentUrls;
    if (isLikelyStoragePathOrUrl(message.content)) {
        const fallback = resolveMediaUrl(message.content);
        return fallback ? [fallback] : [];
    }

    return [];
}

export function formatMessageTime(value?: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function isEmojiOnlyText(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/[A-Za-z0-9]/.test(trimmed)) return false;

    const compact = trimmed.replace(/\s+/g, "");
    return compact.length <= 10;
}

export function formatReplyLabel(args: {
    currentUserId: number;
    messageSenderId: number;
    messageSenderName: string;
    replySenderId?: number;
    replySenderName: string;
}): string {
    const {
        currentUserId,
        messageSenderId,
        messageSenderName,
        replySenderId,
        replySenderName,
    } = args;

    const senderLabel =
        messageSenderId === currentUserId ? "Ban" : messageSenderName;

    if (typeof replySenderId !== "number") {
        return `${senderLabel} da tra loi mot tin nhan`;
    }

    const repliedLabel =
        replySenderId === currentUserId ? "ban" : replySenderName;
    return `${senderLabel} da tra loi ${repliedLabel}`;
}

export function getFileBadgeLabel(fileName?: string): string {
    const ext = fileName?.split(".").pop()?.trim().toUpperCase() ?? "FILE";
    if (!ext) return "FILE";
    return ext.slice(0, 4);
}

export function resolvePinSystemPreview(message: Message): string {
    const source =
        message.replyInfo?.content ||
        message.content ||
        message.attachments?.[0]?.fileName ||
        "tin nhan";

    const preview = source.trim();
    if (!preview) return "tin nhan";
    return preview.length > 50 ? `${preview.slice(0, 50)}...` : preview;
}

export function parseCallMeta(message: Message): {
    icon: "call-outline" | "call" | "videocam-outline" | "close-circle-outline";
    iconColor: string;
    title: string;
    subtitle: string;
} | null {
    if (message.type !== "CALL") return null;

    let payload: Record<string, unknown> = {};
    if (message.content) {
        try {
            payload = JSON.parse(message.content) as Record<string, unknown>;
        } catch {
            payload = {};
        }
    }

    const kind = String(
        payload.callType ?? payload.type ?? "audio",
    ).toLowerCase();
    const status = String(
        payload.status ?? payload.result ?? "ended",
    ).toLowerCase();
    const durationSeconds = Number(
        payload.durationSeconds ?? payload.duration ?? 0,
    );

    const isVideo = kind.includes("video");
    const isMissed = status.includes("miss") || status.includes("reject");
    const subtitle =
        durationSeconds > 0
            ? `Thoi luong ${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`
            : formatMessageTime(message.createdAt) || "Cuoc goi";

    return {
        icon: isMissed
            ? "close-circle-outline"
            : isVideo
              ? "videocam-outline"
              : "call-outline",
        iconColor: isMissed ? "#EF4444" : "#10B981",
        title: isVideo ? "Cuoc goi video" : "Cuoc goi thoai",
        subtitle,
    };
}

export function isPinSystemMessageType(type?: Message["type"]): boolean {
    return type === "SYSTEM_PIN" || type === "SYSTEM_UPIN";
}

export function buildReplyPreview(message: Message): string {
    if (message.isRecalled) return "Tin nhan da duoc thu hoi";
    if (message.type === "IMAGE") return "[Hinh anh]";
    if (message.type === "VIDEO") return "[Video]";
    if (message.type === "AUDIO") return "[Tin nhan thoai]";
    if (message.type === "FILE") return "[Tep dinh kem]";
    if (message.type === "CALL") return "[Cuoc goi]";
    return message.content || "Tin nhan";
}

export function normalizeSearchText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export function inferReplyPreviewType(
    replyInfo?: Message["replyInfo"],
): Message["type"] | null {
    if (!replyInfo) return null;
    if (replyInfo.type) return replyInfo.type;

    const rawContent = (replyInfo.content ?? "").trim();
    const normalizedContent = normalizeSearchText(rawContent);
    if (!normalizedContent) return null;

    if (
        normalizedContent === "[hinh anh]" ||
        normalizedContent === "hinh anh" ||
        normalizedContent === "[anh]" ||
        normalizedContent === "anh"
    ) {
        return "IMAGE";
    }

    if (normalizedContent === "[video]" || normalizedContent === "video") {
        return "VIDEO";
    }

    if (
        normalizedContent === "[tin nhan thoai]" ||
        normalizedContent === "tin nhan thoai" ||
        normalizedContent === "[audio]" ||
        normalizedContent === "audio"
    ) {
        return "AUDIO";
    }

    if (
        normalizedContent === "[tep dinh kem]" ||
        normalizedContent === "tep dinh kem" ||
        normalizedContent === "[file dinh kem]" ||
        normalizedContent === "file dinh kem" ||
        normalizedContent === "[file]" ||
        normalizedContent === "file"
    ) {
        return "FILE";
    }

    if (
        normalizedContent === "[cuoc goi]" ||
        normalizedContent === "cuoc goi" ||
        normalizedContent === "[call]" ||
        normalizedContent === "call"
    ) {
        return "CALL";
    }

    if (/\.(png|jpg|jpeg|gif|webp|bmp)(\?|$)/i.test(rawContent)) {
        return "IMAGE";
    }
    if (/\.(mp4|mov|mkv|avi)(\?|$)/i.test(rawContent)) return "VIDEO";
    if (/\.(mp3|wav|m4a|aac|webm)(\?|$)/i.test(rawContent)) {
        return "AUDIO";
    }

    return null;
}

export function buildAudioWaveBars(seedSource: string, count = 30): number[] {
    let seed = seedSource
        .split("")
        .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 17);

    return Array.from({ length: count }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        return 15 + (Math.abs(seed) % 70);
    });
}
