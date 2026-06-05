import {
    CheckCircle2,
    ChevronLeft,
    Clock,
    Copy,
    CornerUpLeft,
    CornerUpRight,
    Download,
    EyeOff,
    ExternalLink,
    File,
    FileSpreadsheet,
    FileText,
    FileVideoCamera,
    FolderOpen,
    Image as ImageIcon,
    ListChecks,
    Loader2,
    Lock,
    Mic,
    MoreVertical,
    Paperclip,
    Phone,
    PhoneOff,
    Pin,
    Play,
    Plus,
    Presentation,
    ShieldCheck,
    Settings,
    Trash2,
    Undo2,
    Users,
    Video,
    VideoOff,
    X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import type {
    Conversation,
    ConversationMember,
    ConversationPreview,
    InviteUserStatus,
    Message,
    MessageType,
    PollResponse,
} from "../../services/chatService";
import chatService from "../../services/chatService";
import {
    formatBytes,
    getFileNameFromUrl,
    getFileTypeBadge,
    getFileTypePalette,
    getReplyMediaType,
    isAudioFile,
    isDocumentCategory,
    isEmojiOnly,
    isGroupSystemType,
    isImageFile,
    isLikelyMediaSource,
    parseReplyContent,
    resolveFileCategory,
    resolveLocalAvailabilityLabel,
    resolveVideoPosterUrl,
} from "../../utils/messageBubbleUtils";
import { buildS3Url } from "../../utils/s3";
import { buildSystemGroupMessage } from "../../utils/systemCreateGroupMessage";
import {
    LOCKED_ACCOUNT_AVATAR_URL,
    LOCKED_ACCOUNT_NAME,
} from "../../utils/lockedAccount";
import AudioPlayer from "./AudioPlayer";
import ReactionDetailModal from "./ReactionDetailModal";

function extractGroupInviteUrl(content: string): string | null {
    const match = content.match(/https?:\/\/[^\s]+\/g\/[A-Za-z0-9_-]+/);
    return match?.[0] ?? null;
}

function extractGroupInviteToken(url: string): string | null {
    const match = url.match(/\/g\/([A-Za-z0-9_-]+)/);
    return match?.[1] ?? null;
}

function isPollExpired(poll?: PollResponse | null): boolean {
    if (!poll?.expiresAt) return false;
    return new Date(poll.expiresAt).getTime() <= Date.now();
}

function formatPollEndLabel(value?: string | null, ended = false): string {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    const time = date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    });
    const dayLabel = sameDay
        ? "Hom nay"
        : `ngay ${date.toLocaleDateString("vi-VN")}`;
    return `${ended ? "Da ket thuc luc" : "Ket thuc luc"} ${time} ${dayLabel}`;
}

function formatContextDay(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    return sameDay ? "Hom nay" : `ngay ${date.toLocaleDateString("vi-VN")}`;
}

function isPollSystemType(type: MessageType): boolean {
    return type.startsWith("SYSTEM_POLL_");
}

function isAnonymousPollActorMessage(type: MessageType): boolean {
    return type === "SYSTEM_POLL_VOTED" || type === "SYSTEM_POLL_CHANGED";
}

function buildPollSystemText(type: MessageType, title?: string | null, actorLabel = "Ban"): string {
    const pollTitle = title?.trim() || "binh chon";
    switch (type) {
        case "SYSTEM_POLL_CREATED":
            return `${actorLabel} tao cuoc binh chon moi: ${pollTitle}`;
        case "SYSTEM_POLL_VOTED":
            return `${actorLabel} tham gia cuoc binh chon: ${pollTitle}`;
        case "SYSTEM_POLL_CHANGED":
            return `${actorLabel} doi lua chon trong cuoc binh chon: ${pollTitle}`;
        case "SYSTEM_POLL_CLOSED":
            return `${actorLabel} khoa binh chon: ${pollTitle}`;
        case "SYSTEM_POLL_PINNED":
            return `${actorLabel} ghim binh chon: ${pollTitle}`;
        default:
            return pollTitle;
    }
}

function resolveJoinedConversationId(
    payload: Conversation | { message?: string },
): number | null {
    if (!payload || typeof payload !== "object") return null;
    const record = payload as Record<string, unknown>;
    const id = Number(record.conversationId ?? record.id);
    return Number.isFinite(id) ? id : null;
}

function pickApiMessage(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    return (
        pickApiMessage(record.message) ||
        pickApiMessage(record.error) ||
        pickApiMessage(record.data) ||
        pickApiMessage(record.errors)
    );
}

function extractApiErrorMessage(error: unknown): string | null {
    if (error && typeof error === "object") {
        const responseData = (error as { response?: { data?: unknown } })
            .response?.data;
        const fromResponse = pickApiMessage(responseData);
        if (fromResponse) return fromResponse;
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }

    return null;
}

function renderTextWithLinks(content: string, isOwn: boolean): ReactNode {
    const parts = content.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, index) => {
        if (!/^https?:\/\/[^\s]+$/.test(part)) {
            return part;
        }

        return (
            <a
                key={`${part}-${index}`}
                href={part}
                target="_blank"
                rel="noreferrer"
                style={{
                    textDecorationLine: "underline",
                    textUnderlineOffset: "2px",
                }}
                className={`font-medium hover:opacity-80 ${
                    isOwn ? "text-white" : "text-blue-600 dark:text-blue-300"
                }`}
                onClick={(event) => event.stopPropagation()}
            >
                {part}
            </a>
        );
    });
}

const LONG_TEXT_PREVIEW_LENGTH = 900;

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
    onForward?: (message: Message) => void;
    onJumpToMessage?: (messageId: string) => void;
    onRecall: (messageId: string) => void;
    canRecallOwnMessages?: boolean;
    onRecallCall?: (callType: "audio" | "video") => void;
    onDeleteForMe?: (messageId: string) => void;
    onReaction?: (messageId: string, emoji: string) => void;
    onOpenRequireApprovalDetails?: () => void;
    onOpenPollMessage?: (messageId: string) => void;
    openPollModalToken?: number;
    onPollModalClose?: () => void;
    onMediaLoad?: () => void;
    onOpenMediaViewer?: (url: string) => void;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    isHighlighted?: boolean;
    currentUserId: number;
    membersById?: Record<number, ConversationMember>;
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
    onForward,
    onJumpToMessage,
    onRecall,
    canRecallOwnMessages = true,
    onRecallCall,
    onDeleteForMe,
    onReaction,
    onOpenRequireApprovalDetails,
    onOpenPollMessage,
    openPollModalToken,
    onPollModalClose,
    onMediaLoad,
    onOpenMediaViewer,
    isFirstInGroup = true,
    isLastInGroup = true,
    isHighlighted = false,
    currentUserId,
    membersById = {},
}: MessageBubbleProps) {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [reactionOpen, setReactionOpen] = useState(false);
    const [reactionDetailOpen, setReactionDetailOpen] = useState(false);
    const reactionRef = useRef<HTMLDivElement>(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteJoining, setInviteJoining] = useState(false);
    const [inviteCancelling, setInviteCancelling] = useState(false);
    const [inviteError, setInviteError] = useState("");
    const [invitePreview, setInvitePreview] =
        useState<ConversationPreview | null>(null);
    const [inviteUserStatus, setInviteUserStatus] =
        useState<InviteUserStatus | null>(null);
    const [localPoll, setLocalPoll] = useState<PollResponse | null>(
        message.poll ?? null,
    );
    const [pollUpdating, setPollUpdating] = useState(false);
    const [pollModalOpen, setPollModalOpen] = useState(false);
    const [pollDetailOpen, setPollDetailOpen] = useState(false);
    const [pollSettingsOpen, setPollSettingsOpen] = useState(false);
    const [pollCloseConfirmOpen, setPollCloseConfirmOpen] = useState(false);
    const [pollAddingOption, setPollAddingOption] = useState(false);
    const [pollDraftOptionIds, setPollDraftOptionIds] = useState<string[]>([]);
    const [pollNewOptionText, setPollNewOptionText] = useState("");
    const [, setPollClockTick] = useState(0);
    const [textExpanded, setTextExpanded] = useState(false);
    const shouldCollapseText =
        message.type === "TEXT" &&
        !message.isRecalled &&
        message.content.length > LONG_TEXT_PREVIEW_LENGTH;
    const visibleTextContent =
        shouldCollapseText && !textExpanded
            ? `${message.content.slice(0, LONG_TEXT_PREVIEW_LENGTH).trimEnd()}...`
            : message.content;
    const pollSelectionByIdRef = useRef<Record<string, string[]>>({});
    const [menuPosition, setMenuPosition] = useState<{
        top: number;
        left?: number;
        right?: number;
        placement: "above" | "below";
    } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const nextPoll = message.poll ?? null;
        setLocalPoll((previousPoll) => {
            if (!nextPoll || !previousPoll) {
                return nextPoll;
            }

            const hasRememberedSelectedIds = Object.prototype.hasOwnProperty.call(
                pollSelectionByIdRef.current,
                nextPoll.id,
            );
            const rememberedSelectedIds = pollSelectionByIdRef.current[nextPoll.id];
            const nextSelectedIds = nextPoll.currentUserOptionIds ?? [];
            const previousSelectedIds = previousPoll.currentUserOptionIds ?? [];
            const selectedIds =
                hasRememberedSelectedIds
                    ? rememberedSelectedIds
                    : nextSelectedIds.length > 0
                      ? nextSelectedIds
                      : previousSelectedIds;

            if (!hasRememberedSelectedIds && selectedIds.length === 0) {
                return nextPoll;
            }

            const selectedSet = new Set(selectedIds);
            return {
                ...nextPoll,
                currentUserOptionIds: selectedIds,
                options: nextPoll.options.map((option) => ({
                    ...option,
                    selectedByCurrentUser:
                        hasRememberedSelectedIds
                            ? selectedSet.has(option.id)
                            : option.selectedByCurrentUser ||
                              selectedSet.has(option.id),
                })),
            };
        });
    }, [message.poll]);

    useEffect(() => {
        if (!pollModalOpen || !localPoll) return;
        setPollDraftOptionIds(localPoll.currentUserOptionIds ?? []);
    }, [localPoll, pollModalOpen]);

    useEffect(() => {
        if (!openPollModalToken || message.type !== "POLL") return;
        setPollModalOpen(true);
    }, [message.type, openPollModalToken]);

    const closePollModal = useCallback(() => {
        setPollModalOpen(false);
        setPollDetailOpen(false);
        setPollSettingsOpen(false);
        setPollCloseConfirmOpen(false);
        onPollModalClose?.();
    }, [onPollModalClose]);

    useEffect(() => {
        if (!localPoll?.expiresAt || isPollExpired(localPoll)) return;
        const delay = Math.max(
            0,
            new Date(localPoll.expiresAt).getTime() - Date.now() + 250,
        );
        const timer = window.setTimeout(
            () => setPollClockTick((value) => value + 1),
            delay,
        );
        return () => window.clearTimeout(timer);
    }, [localPoll?.expiresAt]);

    const updateMenuPosition = useCallback(() => {
        const button = menuButtonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const estimatedMenuHeight = message.isRecalled
            ? 56
            : isOwn && canRecallOwnMessages
              ? 360
              : 320;
        const shouldOpenBelow = rect.top < estimatedMenuHeight + 56;

        setMenuPosition({
            top: shouldOpenBelow ? rect.bottom + 6 : rect.top - 6,
            placement: shouldOpenBelow ? "below" : "above",
            ...(isOwn
                ? { right: window.innerWidth - rect.right }
                : { left: rect.left }),
        });
    }, [canRecallOwnMessages, isOwn, message.isRecalled]);

    useEffect(() => {
        if (!menuOpen) return;
        updateMenuPosition();

        function handleOutside(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        }
        function handleWindowChange() {
            updateMenuPosition();
        }

        document.addEventListener("mousedown", handleOutside);
        window.addEventListener("resize", handleWindowChange);
        window.addEventListener("scroll", handleWindowChange, true);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            window.removeEventListener("resize", handleWindowChange);
            window.removeEventListener("scroll", handleWindowChange, true);
        };
    }, [menuOpen, updateMenuPosition]);

    // Close reaction picker when clicking outside
    useEffect(() => {
        if (!reactionOpen) return;
        function handleOutside(e: MouseEvent) {
            if (
                reactionRef.current &&
                !reactionRef.current.contains(e.target as Node)
            ) {
                setReactionOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [reactionOpen]);

    const groupInviteUrl =
        (message.type === "TEXT" || message.type === "LINK") && !message.isRecalled
            ? extractGroupInviteUrl(message.content)
            : null;
    const groupInviteToken = groupInviteUrl
        ? extractGroupInviteToken(groupInviteUrl)
        : null;

    const handleCopy = useCallback(() => {
        if (message.content) navigator.clipboard.writeText(message.content);
        setMenuOpen(false);
    }, [message.content]);

    const openInvitePreview = useCallback(async () => {
        if (!groupInviteToken) return;

        setInviteModalOpen(true);
        setInviteLoading(true);
        setInviteError("");
        setInviteCancelling(false);
        setInvitePreview(null);
        setInviteUserStatus(null);

        try {
            const preview = await chatService.previewInvite(groupInviteToken);
            if (preview.userStatus === "ACTIVE") {
                navigate(`/messages/${preview.conversationId}`);
                setInviteModalOpen(false);
                return;
            }

            setInvitePreview(preview);
            setInviteUserStatus(preview.userStatus);
        } catch {
            setInviteError(
                "Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa.",
            );
        } finally {
            setInviteLoading(false);
        }
    }, [groupInviteToken, navigate]);

    const handleJoinInvite = useCallback(async () => {
        if (!groupInviteToken || inviteUserStatus !== "NOT_MEMBER") return;

        try {
            setInviteJoining(true);
            const response = await chatService.joinByInvite(groupInviteToken);
            const conversationId = resolveJoinedConversationId(response);
            if (conversationId) {
                setInviteModalOpen(false);
                navigate(`/messages/${conversationId}`);
                return;
            }

            setInviteUserStatus("PENDING");
            toast.success("Đã gửi yêu cầu tham gia nhóm.");
            setInviteModalOpen(false);
        } catch (error) {
            console.log(error);
            const message = extractApiErrorMessage(error);
            toast.error(message || "Bạn đã bị chặn khỏi nhóm.");
        } finally {
            setInviteJoining(false);
        }
    }, [groupInviteToken, inviteUserStatus, navigate]);

    const handleCancelInviteRequest = useCallback(async () => {
        if (!invitePreview || inviteUserStatus !== "PENDING") return;

        try {
            setInviteCancelling(true);
            await chatService.cancelMyJoinRequest(invitePreview.conversationId);
            setInviteUserStatus("NOT_MEMBER");
            toast.success("Đã hủy yêu cầu tham gia nhóm.");
        } catch (error) {
            const message = extractApiErrorMessage(error);
            toast.error(message || "Không thể hủy yêu cầu tham gia.");
        } finally {
            setInviteCancelling(false);
        }
    }, [invitePreview, inviteUserStatus]);

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

    const handleForwardClick = useCallback(() => {
        onForward?.(message);
        setMenuOpen(false);
    }, [message, onForward]);

    const handleDeleteForMeClick = useCallback(() => {
        onDeleteForMe?.(message.id);
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
    const isGroupSystemMessage = isGroupSystemType(message.type);

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
    const normalizeMediaUrl = (url?: string) => buildS3Url(url) || url || "";
    const imageUrls =
        message.type === "IMAGE"
            ? messageAttachments
                  .map((attachment) => normalizeMediaUrl(attachment.url))
                  .filter((url): url is string => Boolean(url))
            : [];
    const audioUrls =
        message.type === "AUDIO"
            ? messageAttachments
                  .map((attachment) => normalizeMediaUrl(attachment.url))
                  .filter((url): url is string => Boolean(url))
            : [];
    const fileAttachment =
        message.type === "FILE" || message.type === "VIDEO"
            ? messageAttachments[0]
            : undefined;
    const resolvedFileName =
        fileAttachment?.fileName ||
        getFileNameFromUrl(fileAttachment?.url, fileNameFromUrl);
    const resolvedFileUrl = normalizeMediaUrl(fileAttachment?.url || message.content);
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

    const handleTogglePollOption = useCallback(
        async (optionId: string) => {
            const poll = localPoll;
            if (!poll || poll.closed || poll.recalled || isPollExpired(poll) || pollUpdating) return;

            const selected = poll.currentUserOptionIds ?? [];
            const nextSelected = poll.allowMultipleChoices
                ? selected.includes(optionId)
                    ? selected.filter((id) => id !== optionId)
                    : [...selected, optionId]
                : selected.includes(optionId)
                  ? []
                  : [optionId];

            setPollUpdating(true);
            try {
                const updated =
                    nextSelected.length === 0
                        ? await chatService.removePollVote(poll.id)
                        : await chatService.votePoll(poll.id, nextSelected);
                pollSelectionByIdRef.current[poll.id] =
                    updated.currentUserOptionIds ?? nextSelected;
                setLocalPoll(updated);
            } catch (error) {
                toast.error("Không thể cập nhật bình chọn");
            } finally {
                setPollUpdating(false);
            }
        },
        [localPoll, pollUpdating],
    );

    const togglePollDraftOption = useCallback(
        (optionId: string) => {
            const poll = localPoll;
            if (!poll || poll.closed || poll.recalled || isPollExpired(poll) || pollUpdating) return;

            setPollDraftOptionIds((current) => {
                if (poll.allowMultipleChoices) {
                    return current.includes(optionId)
                        ? current.filter((id) => id !== optionId)
                        : [...current, optionId];
                }
                return current.includes(optionId) ? [] : [optionId];
            });
        },
        [localPoll, pollUpdating],
    );

    const submitPollDraft = useCallback(async () => {
        const poll = localPoll;
        if (!poll || poll.closed || poll.recalled || isPollExpired(poll) || pollUpdating) return;

        setPollUpdating(true);
        try {
            const updated =
                pollDraftOptionIds.length === 0
                    ? await chatService.removePollVote(poll.id)
                    : await chatService.votePoll(poll.id, pollDraftOptionIds);
            pollSelectionByIdRef.current[poll.id] =
                updated.currentUserOptionIds ?? pollDraftOptionIds;
            setLocalPoll(updated);
            setPollDraftOptionIds(updated.currentUserOptionIds ?? []);
            closePollModal();
        } catch {
            toast.error("Khong the cap nhat binh chon");
        } finally {
            setPollUpdating(false);
        }
    }, [closePollModal, localPoll, pollDraftOptionIds, pollUpdating]);

    const submitPollNewOption = useCallback(async () => {
        const poll = localPoll;
        const text = pollNewOptionText.trim();
        if (!poll || !text || isPollExpired(poll) || pollUpdating) return;

        setPollUpdating(true);
        try {
            const updated = await chatService.addPollOption(poll.id, text);
            setLocalPoll(updated);
            setPollNewOptionText("");
            setPollAddingOption(false);
        } catch {
            toast.error("Khong the them lua chon");
        } finally {
            setPollUpdating(false);
        }
    }, [localPoll, pollNewOptionText, pollUpdating]);

    const closePoll = useCallback(async () => {
        const poll = localPoll;
        if (!poll || poll.closed || poll.recalled || pollUpdating) return;

        setPollUpdating(true);
        try {
            const updated = await chatService.closePoll(poll.id);
            setLocalPoll(updated);
            setPollCloseConfirmOpen(false);
            setPollSettingsOpen(false);
        } catch {
            toast.error("Khong the khoa binh chon");
        } finally {
            setPollUpdating(false);
        }
    }, [localPoll, pollUpdating]);

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

    const pollCreator = localPoll?.creatorId
        ? membersById[localPoll.creatorId]
        : undefined;
    const pollCreatorName = pollCreator?.accountLocked
        ? LOCKED_ACCOUNT_NAME
        : pollCreator?.nickname ||
          pollCreator?.username ||
          (localPoll?.creatorId === currentUserId ? "Ban" : senderName);
    const pollUniqueVoterIds = useMemo(() => {
        const ids = new Set<number>();
        for (const option of localPoll?.options ?? []) {
            for (const voterId of option.voterIds ?? []) {
                ids.add(Number(voterId));
            }
        }
        return Array.from(ids);
    }, [localPoll?.options]);
    const pollTotalVotes = localPoll?.totalVoteCount ?? 0;
    const pollUniqueVoterCount =
        localPoll?.totalVoterCount ??
        (pollUniqueVoterIds.length || pollTotalVotes);
    const pollSummaryText =
        pollUniqueVoterCount > 0
            ? `${pollUniqueVoterCount} nguoi da binh chon`
            : "Chua co ai binh chon";
    const pollExpired = isPollExpired(localPoll);
    const pollEnded = Boolean(
        localPoll && (localPoll.closed || localPoll.recalled || pollExpired),
    );
    const pollHasEndTime = Boolean(localPoll?.expiresAt || pollEnded);
    const pollEndTime = localPoll?.expiresAt || (pollEnded ? localPoll?.updatedAt : null);
    const pollClosedTimeLabel = formatPollEndLabel(pollEndTime, pollEnded);
    const pollCreatedDayLabel = formatContextDay(localPoll?.createdAt || message.createdAt);
    const currentUserRole = membersById[currentUserId]?.role;
    const canClosePoll =
        Boolean(localPoll?.creatorId) &&
        (Number(localPoll?.creatorId) === Number(currentUserId) ||
            currentUserRole === "OWNER" ||
            currentUserRole === "DEPUTY");

    const getPollMember = useCallback(
        (userIdToFind: number) => membersById[userIdToFind],
        [membersById],
    );

    const getPollMemberName = useCallback(
        (userIdToFind: number) => {
            const member = getPollMember(userIdToFind);
            if (Number(userIdToFind) === Number(currentUserId)) return "Ban";
            if (member?.accountLocked) return LOCKED_ACCOUNT_NAME;
            return (
                member?.nickname ||
                member?.username ||
                `Nguoi dung ${userIdToFind}`
            );
        },
        [currentUserId, getPollMember],
    );

    const getPollMemberAvatar = useCallback(
        (userIdToFind: number) => {
            const member = getPollMember(userIdToFind);
            if (member?.accountLocked) return LOCKED_ACCOUNT_AVATAR_URL;
            return member?.avatar || defaultAvatarSmallUrl;
        },
        [defaultAvatarSmallUrl, getPollMember],
    );

    const renderPollAvatarStack = useCallback(
        (voterIds: number[] = []) => {
            const uniqueIds = Array.from(new Set(voterIds.map(Number)));
            const visibleIds = uniqueIds.slice(0, 3);
            const hiddenCount = Math.max(
                0,
                uniqueIds.length - visibleIds.length,
            );

            return (
                <span className="flex items-center justify-end -space-x-2">
                    {visibleIds.map((voterId) => (
                        <img
                            key={voterId}
                            src={getPollMemberAvatar(voterId)}
                            alt={getPollMemberName(voterId)}
                            className="h-7 w-7 rounded-full border-2 border-white object-cover dark:border-[#111111]"
                        />
                    ))}
                    {hiddenCount > 0 && (
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-gray-200 px-1 text-[10px] font-bold text-gray-700 dark:border-[#111111] dark:bg-gray-700 dark:text-gray-100">
                            +{hiddenCount}
                        </span>
                    )}
                </span>
            );
        },
        [getPollMemberAvatar, getPollMemberName],
    );

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

    // Incoming avatar kiểu Messenger/Zalo:
    // - Chỉ tin nhắn cuối nhóm mới hiện avatar
    // - Các tin nhắn incoming khác giữ slot rỗng để bubble thẳng hàng
    const showIncomingAvatarSlot = !isOwn;
    const showIncomingAvatar = showIncomingAvatarSlot && isLastInGroup;
    const showIncomingGroupSenderName =
        conversationType === "GROUP" && !isOwn && isFirstInGroup;

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

    if (isGroupSystemMessage) {
        const pollSystem = isPollSystemType(message.type);
        const content = pollSystem
            ? ""
            : buildSystemGroupMessage({
                  type: message.type as
                      | "SYSTEM_CREATE_GROUP"
                      | "SYSTEM_ADD_MEMBER"
                      | "SYSTEM_UPDATE_ROLE"
                      | "SYSTEM_KICK_MEMBER"
                      | "SYSTEM_BLOCK_MEMBER"
                      | "SYSTEM_MEMBER_BLOCKED_FROM_JOIN"
                      | "SYSTEM_LEAVE_GROUP"
                      | "SYSTEM_DISBAND_GROUP"
                      | "SYSTEM_UPDATE_SETTING"
                      | "SYSTEM_REQUIRE_APPROVAL"
                      | "SYSTEM_JOIN_VIA_LINK"
                      | "SYSTEM_GROUP_INVITE_LINK_SENT",
                  content: message.content,
                  isOwn,
                  senderName,
                  senderId: message.senderId,
                  currentUserId,
                  membersById,
              });
        const currentMemberRole = membersById[currentUserId]?.role;
        const canOpenRequireApprovalDetails =
            message.type === "SYSTEM_REQUIRE_APPROVAL" &&
            (currentMemberRole === "OWNER" || currentMemberRole === "DEPUTY") &&
            Boolean(onOpenRequireApprovalDetails);
        const pollMessageId = message.replyInfo?.messageId;
        const pollActorLabel =
            pollSystem && isAnonymousPollActorMessage(message.type) && Number(message.senderId) <= 0
                ? "Mot thanh vien"
                : isOwn
                  ? "Ban"
                  : senderName;

        return (
            <div className="w-full flex justify-center">
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200">
                    {pollSystem ? (
                        <ListChecks size={13} className="shrink-0 text-emerald-500" />
                    ) : (
                        <Users size={12} className="shrink-0" />
                    )}
                    <span className="truncate">
                        {pollSystem ? buildPollSystemText(message.type, message.content, pollActorLabel) : content}
                    </span>
                    {canOpenRequireApprovalDetails && (
                        <button
                            type="button"
                            onClick={onOpenRequireApprovalDetails}
                            className="shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Chi tiết
                        </button>
                    )}
                    {pollSystem && pollMessageId && (
                        <button
                            type="button"
                            onClick={() => onOpenPollMessage?.(pollMessageId)}
                            className="shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Xem
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (message.type === "POLL" && localPoll) {
        const selectedOptionIds = localPoll.currentUserOptionIds ?? [];

        return (
            <div className="w-full flex justify-center">
                <button
                    type="button"
                    onClick={() => setPollModalOpen(true)}
                    className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-4 text-left text-gray-900 shadow-md shadow-slate-200/70 transition hover:border-blue-200 hover:shadow-lg dark:border-[#303030] dark:bg-[#111111] dark:text-gray-100 dark:shadow-black/30"
                >
                    <h3 className="text-lg font-bold leading-tight">
                        {localPoll.title || message.content}
                    </h3>
                    {pollEnded ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {pollClosedTimeLabel || "Da ket thuc"}
                        </p>
                    ) : (
                        <div className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-500">
                            <span>{pollSummaryText}</span>
                            <span className="flex items-center">
                                <Play
                                    size={9}
                                    fill="currentColor"
                                    stroke="none"
                                />
                            </span>
                        </div>
                    )}
                    {!pollEnded && pollHasEndTime && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {pollClosedTimeLabel}
                        </p>
                    )}
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {localPoll.allowMultipleChoices
                            ? "Chon nhieu phuong an"
                            : "Chon mot phuong an"}
                    </p>
                    <div className="mt-4 space-y-2">
                        {localPoll.options.slice(0, 3).map((option) => {
                            const selected =
                                selectedOptionIds.includes(option.id) ||
                                option.selectedByCurrentUser;
                            const voterIds = option.voterIds ?? [];
                            return (
                                <div
                                    key={option.id}
                                    className={`flex min-h-10 items-center justify-between rounded-md px-3 text-base ${
                                        selected
                                            ? "bg-blue-200/80 dark:bg-blue-500/25"
                                            : "bg-gray-100 dark:bg-gray-800"
                                    }`}
                                >
                                    <span className="truncate">
                                        {option.text}
                                    </span>
                                    {renderPollAvatarStack(voterIds)}
                                </div>
                            );
                        })}
                    </div>
                    {localPoll.options.length > 3 && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            * Con {localPoll.options.length - 3} lua chon khac
                        </p>
                    )}
                    <div
                        className={`mt-3 flex h-9 items-center justify-center rounded-md border text-sm font-bold 
                            
                            border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 hover:bg-blue-50
                               
                        }`}
                    >
                        {pollEnded
                            ? "Xem bình chọn"
                            : selectedOptionIds.length > 0
                              ? "Đổi bình chọn"
                              : "Bình chọn"}
                    </div>
                </button>

                {pollModalOpen && (
                    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 px-4 py-6">
                        <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-md bg-white shadow-2xl dark:bg-[#111111]">
                            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#303030]">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                    Binh chon
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => {
                                        closePollModal();
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {pollDetailOpen ? (
                                <>
                                    <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-[#303030]">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPollDetailOpen(false)
                                            }
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <h3 className="flex-1 text-base font-semibold text-gray-900 dark:text-white">
                                            Chi tiet binh chon
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-5 py-4">
                                        {localPoll.options.map((option) => {
                                            const voters = (
                                                option.voterIds ?? []
                                            ).map(Number);
                                            if (voters.length === 0)
                                                return null;
                                            return (
                                                <div
                                                    key={option.id}
                                                    className="mb-6"
                                                >
                                                    <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
                                                        {option.text} (
                                                        {voters.length})
                                                    </p>
                                                    <div className="space-y-3">
                                                        {voters.map(
                                                            (voterId) => (
                                                                <div
                                                                    key={`${option.id}-${voterId}`}
                                                                    className="flex items-center gap-3"
                                                                >
                                                                    <img
                                                                        src={getPollMemberAvatar(
                                                                            voterId,
                                                                        )}
                                                                        alt={getPollMemberName(
                                                                            voterId,
                                                                        )}
                                                                        className="h-10 w-10 rounded-full object-cover"
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                                                        {getPollMemberName(
                                                                            voterId,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-y-auto px-4 py-5">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {localPoll.title || message.content}
                                        </h3>
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Tao boi {pollCreatorName}
                                            {pollCreatedDayLabel ? ` · ${pollCreatedDayLabel}` : ""}
                                        </p>
                                        <p className="mt-5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            {pollHasEndTime && (
                                                <>
                                                    <Clock size={16} />
                                                    {pollClosedTimeLabel}
                                                </>
                                            )}
                                        </p>
                                        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <ListChecks size={16} />
                                            {localPoll.allowMultipleChoices
                                                ? "Chon nhieu phuong an"
                                                : "Chon mot phuong an"}
                                        </p>
                                        {localPoll.anonymous && (
                                            <p className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <EyeOff size={16} />
                                                An nguoi binh chon
                                            </p>
                                        )}
                                        <div className="my-4 h-px bg-gray-200 dark:bg-[#303030]" />
                                        {localPoll.anonymous ? (
                                            <p className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                                                {pollUniqueVoterCount} nguoi
                                                binh chon, {pollTotalVotes} luot
                                                binh chon
                                            </p>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPollDetailOpen(true)
                                                }
                                                className="mb-4 flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                                            >
                                                <span>
                                                    {pollUniqueVoterCount} nguoi
                                                    binh chon, {pollTotalVotes}{" "}
                                                    luot binh chon
                                                </span>
                                                <span>›</span>
                                            </button>
                                        )}

                                        <div className="space-y-2">
                                            {localPoll.options.map((option) => {
                                                const selected =
                                                    pollDraftOptionIds.includes(
                                                        option.id,
                                                    );
                                                const voters = (
                                                    option.voterIds ?? []
                                                ).map(Number);
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() =>
                                                            togglePollDraftOption(
                                                                option.id,
                                                            )
                                                        }
                                                        disabled={
                                                            pollUpdating ||
                                                            pollEnded
                                                        }
                                                        className="flex w-full items-center gap-3 disabled:cursor-not-allowed disabled:opacity-70"
                                                    >
                                                        <span
                                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                                selected
                                                                    ? "border-blue-600 bg-blue-600 text-white"
                                                                    : "border-gray-300 bg-white dark:border-gray-600 dark:bg-[#111111]"
                                                            }`}
                                                        >
                                                            {selected && (
                                                                <CheckCircle2
                                                                    size={14}
                                                                />
                                                            )}
                                                        </span>
                                                        <span
                                                            className={`flex h-10 min-w-0 flex-1 items-center justify-between rounded px-3 text-left ${
                                                                selected
                                                                    ? "bg-blue-200/80 dark:bg-blue-500/25"
                                                                    : "bg-gray-100 dark:bg-gray-800"
                                                            }`}
                                                        >
                                                            <span className="truncate text-sm">
                                                                {option.text}
                                                            </span>
                                                            {renderPollAvatarStack(
                                                                voters,
                                                            )}
                                                        </span>
                                                        <span className="w-5 text-right text-sm text-gray-700 dark:text-gray-200">
                                                            {option.voteCount}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {pollEnded ? (
                                            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <Lock size={15} />
                                                Binh chon da dong
                                            </p>
                                        ) : localPoll.allowAddOption ? (
                                            pollAddingOption ? (
                                                <div className="mt-4 flex items-center gap-2">
                                                    <input
                                                        value={
                                                            pollNewOptionText
                                                        }
                                                        onChange={(event) =>
                                                            setPollNewOptionText(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        autoFocus
                                                        placeholder="Them lua chon"
                                                        className="h-9 min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-[#303030] dark:bg-black dark:text-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void submitPollNewOption()
                                                        }
                                                        disabled={
                                                            !pollNewOptionText.trim() ||
                                                            pollUpdating ||
                                                            pollEnded
                                                        }
                                                        className="inline-flex h-9 items-center gap-1 rounded px-2 text-sm font-semibold text-blue-600 disabled:opacity-50"
                                                    >
                                                        <Plus size={16} />
                                                        Them
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPollAddingOption(
                                                            true,
                                                        )
                                                    }
                                                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                >
                                                    <Plus size={18} />
                                                    Them lua chon
                                                </button>
                                            )
                                        ) : null}
                                    </div>
                                </>
                            )}

                            <div className="relative flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-[#303030]">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPollSettingsOpen((open) => !open)
                                        }
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Settings size={22} />
                                    </button>
                                    {pollSettingsOpen && (
                                        <div className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl dark:border-[#303030] dark:bg-[#111111]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPollSettingsOpen(false);
                                                    if (isPinned) {
                                                        onUnpin(message.id);
                                                    } else {
                                                        onPin(message.id);
                                                    }
                                                }}
                                                className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                                            >
                                                {isPinned ? "Bo ghim" : "Ghim len dau tro chuyen"}
                                            </button>
                                            {canClosePoll && (
                                                <button
                                                    type="button"
                                                    disabled={
                                                        pollEnded
                                                    }
                                                    onClick={() => {
                                                        setPollSettingsOpen(
                                                            false,
                                                        );
                                                        setPollCloseConfirmOpen(
                                                            true,
                                                        );
                                                    }}
                                                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-800"
                                                >
                                                    Khoa binh chon
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                    onClick={() => {
                                            closePollModal();
                                        }}
                                        className="h-10 rounded-md bg-gray-200 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-300 dark:bg-[#262626] dark:text-gray-100 dark:hover:bg-[#333333]"
                                    >
                                        Huy
                                    </button>
                                    {pollEnded ? null : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void submitPollDraft()
                                            }
                                            disabled={
                                                pollDetailOpen || pollUpdating
                                            }
                                            className="h-10 rounded-md bg-blue-500 px-5 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
                                        >
                                            {pollUpdating
                                                ? "Dang luu..."
                                                : "Xac nhan"}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {pollCloseConfirmOpen && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 px-6">
                                    <div className="w-full max-w-sm overflow-hidden rounded-md bg-white shadow-2xl dark:bg-[#111111]">
                                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#303030]">
                                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                                Khoa binh chon?
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPollCloseConfirmOpen(
                                                        false,
                                                    )
                                                }
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="px-4 py-5">
                                            <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                                                Sau khi khoa, ban va cac thanh
                                                vien khac se khong the tiep tuc
                                                tham gia binh chon
                                            </p>
                                        </div>
                                        <div className="flex justify-end gap-3 px-4 pb-4">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPollCloseConfirmOpen(
                                                        false,
                                                    )
                                                }
                                                className="h-10 rounded-md bg-gray-200 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-300 dark:bg-[#262626] dark:text-gray-100 dark:hover:bg-[#333333]"
                                            >
                                                Khong
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void closePoll()}
                                                disabled={pollUpdating}
                                                className="h-10 rounded-md bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                            >
                                                Khoa binh chon
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={`flex items-end gap-1 overflow-visible ${isOwn ? "justify-end" : "justify-start"} group`}
        >
            {showIncomingAvatarSlot && (
                <div className="h-7 w-7 shrink-0 self-end mb-0.5">
                    {showIncomingAvatar && (
                        <img
                            src={senderAvatar || defaultAvatarSmallUrl}
                            alt={senderName}
                            className="h-7 w-7 rounded-full object-cover ring-1 ring-gray-200/80 dark:ring-gray-700/80"
                        />
                    )}
                </div>
            )}

            {/* Emoji reaction bar + "..." — hiện khi hover */}
            <div
                className={`relative z-[100] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-center ${
                    isOwn ? "order-first flex-row-reverse" : "order-last"
                }`}
            >
                {/* Reaction emoji pill */}
                <div ref={reactionRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setReactionOpen((v) => !v)}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 mb-4"
                        title="Thả cảm xúc"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                    </button>
                    {reactionOpen && (
                        <div
                            className={`absolute bottom-full mb-1 flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl z-[9999] ${
                                isOwn ? "right-0" : "left-0"
                            }`}
                        >
                            {["👍", "❤️", "😂", "😅", "😭", "😡"].map(
                                (emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => {
                                            setReactionOpen(false);
                                            onReaction?.(message.id, emoji);
                                        }}
                                        className="text-xl leading-none p-0.5 rounded-full hover:scale-125 hover:bg-gray-100 dark:hover:bg-gray-700 transition-transform duration-150"
                                        title={emoji}
                                    >
                                        {emoji}
                                    </button>
                                ),
                            )}
                        </div>
                    )}
                </div>

                {/* "..." menu button */}
                <div ref={menuRef} className="relative">
                    <button
                        ref={menuButtonRef}
                        onClick={() => {
                            updateMenuPosition();
                            setMenuOpen((v) => !v);
                        }}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 mb-4"
                        title="Tùy chọn"
                    >
                        <MoreVertical size={16} />
                    </button>

                    {menuOpen && (
                        <div
                            style={{
                                top: menuPosition?.top,
                                left: menuPosition?.left,
                                right: menuPosition?.right,
                            }}
                            className={`fixed ${menuPosition?.placement === "above" ? "-translate-y-full" : ""} max-h-[min(22rem,calc(100vh-4rem))] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl py-1.5 z-[9999] w-56`}
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
                                            {isPinned
                                                ? "Bỏ ghim"
                                                : "Ghim tin nhắn"}
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleReplyClick}
                                        className={menuItemBase}
                                    >
                                        <CornerUpLeft
                                            size={16}
                                            className="text-gray-500 dark:text-gray-400 shrink-0"
                                        />
                                        <span className="text-gray-800 dark:text-gray-100">
                                            Trả lời
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleForwardClick}
                                        className={menuItemBase}
                                    >
                                        <CornerUpRight
                                            size={16}
                                            className="text-gray-500 dark:text-gray-400 shrink-0"
                                        />
                                        <span className="text-gray-800 dark:text-gray-100">
                                            Chuyển Tiếp
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

                                    {/* Separator + Danger zone */}
                                    <div className="my-1.5 border-t border-gray-100 dark:border-gray-700" />

                                    {/* Thu hồi - chỉ hiện cho tin nhắn của mình */}
                                    {isOwn && canRecallOwnMessages && (
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
            </div>

            {/* Cột: bubble + metadata dưới (với tin người gửi) */}
            <div
                className={`relative flex flex-col max-w-[78%] sm:max-w-[72%] lg:max-w-[68%] overflow-visible ${isOwn ? "items-end" : "items-start"}`}
            >
                {showIncomingGroupSenderName && (
                    <p className="mb-1 px-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        {senderName}
                    </p>
                )}

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
                                              : groupInviteUrl
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
                                                            onClick={() => onOpenMediaViewer?.(url)}
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
                                            onClick={() => onOpenMediaViewer?.(message.content)}
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
                                ) : message.type === "POLL" && localPoll ? (
                                    <div className="w-80 max-w-[78vw] px-3 py-3 text-gray-900 dark:text-gray-100">
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                                                <ListChecks size={18} />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold">
                                                    {localPoll.title ||
                                                        message.content}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {localPoll.allowMultipleChoices
                                                        ? "Chọn nhiều phương án"
                                                        : "Chọn một phương án"}
                                                </span>
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {localPoll.options.map((option) => {
                                                const selected =
                                                    localPoll.currentUserOptionIds?.includes(
                                                        option.id,
                                                    ) ??
                                                    option.selectedByCurrentUser;
                                                const maxVotes = Math.max(
                                                    1,
                                                    ...localPoll.options.map(
                                                        (item) =>
                                                            item.voteCount,
                                                    ),
                                                );
                                                const percent =
                                                    localPoll.totalVoteCount > 0
                                                        ? Math.round(
                                                              (option.voteCount /
                                                                  localPoll.totalVoteCount) *
                                                                  100,
                                                          )
                                                        : 0;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        disabled={
                                                            pollUpdating ||
                                                            pollEnded
                                                        }
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void handleTogglePollOption(
                                                                option.id,
                                                            );
                                                        }}
                                                        className={`relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                                            selected
                                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                                                                : "border-gray-200 bg-gray-100 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                                                        } disabled:cursor-not-allowed disabled:opacity-70`}
                                                    >
                                                        <span
                                                            className="absolute inset-y-0 left-0 bg-blue-500/10"
                                                            style={{
                                                                width: `${Math.max(
                                                                    4,
                                                                    (option.voteCount /
                                                                        maxVotes) *
                                                                        100,
                                                                )}%`,
                                                            }}
                                                        />
                                                        <span className="relative flex items-center justify-between gap-3">
                                                            <span className="truncate">
                                                                {option.text}
                                                            </span>
                                                            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                                                {
                                                                    option.voteCount
                                                                }{" "}
                                                                · {percent}%
                                                            </span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                            <span>
                                                {localPoll.totalVoteCount} lượt
                                                chọn
                                            </span>
                                            {pollEnded && (
                                                <span>Đã đóng</span>
                                            )}
                                        </div>
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
                                ) : groupInviteUrl ? (
                                    <button
                                        type="button"
                                        onClick={openInvitePreview}
                                        className="block w-80 max-w-[78vw] overflow-hidden rounded-2xl bg-blue-50 text-left text-gray-900 shadow-md ring-1 ring-blue-200 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:text-gray-100 dark:ring-blue-900/60 dark:hover:bg-blue-950/45"
                                    >
                                        <div className="mx-3 mt-3 overflow-hidden rounded-xl bg-blue-600">
                                            <div className="relative flex h-28 items-center gap-3 overflow-hidden px-4 text-white">
                                                <span className="absolute -left-8 top-0 h-36 w-36 rounded-full bg-white/10" />
                                                <span className="absolute left-12 top-[-2rem] h-44 w-44 rounded-full bg-white/10" />
                                                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/95 text-gray-400 ring-2 ring-white/80">
                                                    <Users size={28} />
                                                </span>
                                                <span className="relative min-w-0">
                                                    <span className="block text-sm font-medium text-white/85">
                                                        Nhóm
                                                    </span>
                                                    <span className="mt-1 block truncate text-lg font-bold">
                                                        Link tham gia nhóm
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="px-3 py-2.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        Mời tham gia nhóm
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                                        Bấm để xem thông tin
                                                        nhóm
                                                    </span>
                                                </span>
                                                <ExternalLink
                                                    size={16}
                                                    className="shrink-0 text-gray-400"
                                                />
                                            </div>
                                            {isLastInGroup && (
                                                <span className="mt-1 block text-right text-[11px] text-gray-400 dark:text-gray-500">
                                                    {timeStr}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ) : (
                                    <p className="whitespace-pre-wrap px-4 py-1.5 text-sm break-words">
                                        {renderTextWithLinks(
                                            visibleTextContent,
                                            isOwn,
                                        )}
                                        {shouldCollapseText && (
                                            <button
                                                type="button"
                                                className={`ml-1 inline text-sm font-semibold hover:underline ${
                                                    isOwn
                                                        ? "text-white/90"
                                                        : "text-blue-600 dark:text-blue-300"
                                                }`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setTextExpanded((value) => !value);
                                                }}
                                            >
                                                {textExpanded ? "Thu gọn" : "Xem thêm"}
                                            </button>
                                        )}
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

                {/* Reactions indicator */}
                {message.iconName && message.iconName.length > 0 && (
                    <div
                        className={`flex items-center gap-1 mt-0.5 px-1 relative z-10 ${isOwn ? "self-end" : "self-start"}`}
                    >
                        <div
                            className="flex items-center bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)] rounded-full px-1.5 py-0.5 border border-gray-100 dark:border-gray-700 cursor-pointer hover:scale-105 transition-transform active:scale-95"
                            onClick={(e) => {
                                e.stopPropagation();
                                setReactionDetailOpen(true);
                            }}
                        >
                            {message.iconName.slice(0, 3).map((reaction, i) => (
                                <span
                                    key={i}
                                    className="text-[13px] leading-tight flex-shrink-0 -mr-0.5 last:mr-0"
                                >
                                    {reaction.name}
                                </span>
                            ))}
                            {message.iconName.reduce(
                                (sum, r) =>
                                    sum +
                                    r.user.reduce(
                                        (acc, u) => acc + u.quantity,
                                        0,
                                    ),
                                0,
                            ) > 1 && (
                                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 ml-1.5 leading-tight">
                                    {message.iconName.reduce(
                                        (sum, r) =>
                                            sum +
                                            r.user.reduce(
                                                (acc, u) => acc + u.quantity,
                                                0,
                                            ),
                                        0,
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Giờ dưới bubble cho tin nhắn của mình */}
                {!message.isRecalled &&
                    isLastInGroup &&
                    false &&
                    isOwn &&
                    !isFileMessageBubble &&
                    !groupInviteUrl && (
                        <p
                            className={`text-xs mt-0.5 px-1 text-gray-400  dark:text-gray-500 ${isOwn ? "self-end" : "self-start"}`}
                        >
                            {timeStr}
                        </p>
                    )}

                {/* Giờ dưới bubble cho tin nhắn phía đối diện */}
                {!message.isRecalled &&
                    isLastInGroup &&
                    !isOwn &&
                    !isFileMessageBubble &&
                    !groupInviteUrl &&
                    message.type !== "CALL" && (
                        <p className="mt-1 inline-flex h-5 self-start rounded-full bg-gray-300 px-2 text-[11px] font-semibold leading-5 text-white shadow-sm dark:bg-gray-800 dark:text-gray-300">
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
            {inviteModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-[#111111] dark:ring-[#303030]">
                        {inviteLoading ? (
                            <div className="flex h-64 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : inviteError ? (
                            <div className="px-6 py-8 text-center">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                                    <ShieldCheck size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-950 dark:text-white">
                                    Link không khả dụng
                                </h3>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    {inviteError}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setInviteModalOpen(false)}
                                    className="mt-6 h-10 rounded-md bg-gray-100 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-200 dark:bg-[#262626] dark:text-gray-100 dark:hover:bg-[#333333]"
                                >
                                    Đóng
                                </button>
                            </div>
                        ) : invitePreview ? (
                            <div className="px-6 py-7 text-center">
                                <img
                                    src={invitePreview.imageUrl}
                                    alt={invitePreview.name}
                                    className="mx-auto h-20 w-20 rounded-full object-cover ring-1 ring-gray-200 dark:ring-[#303030]"
                                />
                                <h3 className="mt-4 text-xl font-bold text-gray-950 dark:text-white">
                                    {invitePreview.name}
                                </h3>
                                <p className="mt-2 inline-flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Users size={16} />
                                    {invitePreview.memberCount} thành viên
                                </p>
                                {invitePreview.isJoinApprovalRequired && (
                                    <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/25 dark:text-amber-300">
                                        Nhóm này yêu cầu Quản trị viên phê duyệt
                                    </p>
                                )}
                                <div className="mt-7 grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        disabled={
                                            inviteJoining || inviteCancelling
                                        }
                                        onClick={() =>
                                            setInviteModalOpen(false)
                                        }
                                        className="h-10 rounded-md bg-gray-100 text-sm font-semibold text-gray-800 hover:bg-gray-200 disabled:opacity-60 dark:bg-[#262626] dark:text-gray-100 dark:hover:bg-[#333333]"
                                    >
                                        Đóng
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            inviteJoining || inviteCancelling
                                        }
                                        onClick={
                                            inviteUserStatus === "PENDING"
                                                ? handleCancelInviteRequest
                                                : handleJoinInvite
                                        }
                                        className={`h-10 rounded-md text-sm font-semibold disabled:cursor-not-allowed ${
                                            inviteUserStatus === "PENDING"
                                                ? "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-70 dark:bg-[#262626] dark:text-gray-200 dark:hover:bg-[#333333]"
                                                : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70"
                                        }`}
                                    >
                                        {inviteUserStatus === "PENDING"
                                            ? inviteCancelling
                                                ? "Đang hủy..."
                                                : "Hủy yêu cầu"
                                            : inviteJoining
                                              ? "Đang tham gia..."
                                              : "Tham gia nhóm"}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            <ReactionDetailModal
                open={reactionDetailOpen}
                onClose={() => setReactionDetailOpen(false)}
                reactions={message.iconName}
                membersById={membersById}
            />
        </div>
    );
}
