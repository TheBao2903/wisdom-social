import {
    useCallback,
    useMemo,
    useRef,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import {
    Send,
    Phone,
    Video,
    Info,
    ChevronDown,
    ArrowDown,
    Plus,
    X,
    MoreVertical,
    MessageCircle,
    Mic,
    Square,
    Paperclip,
    StickyNote,
    Film,
    Smile,
} from "lucide-react";
import EmojiPicker, {
    Emoji,
    EmojiStyle,
    type EmojiClickData,
    Theme,
} from "emoji-picker-react";
import { useChatWindowController } from "../../hooks/useChatWindowController";
import { MessageBubble } from "./MessageBubble";
import { useCall } from "../../hooks/useCall";
import IncomingCallModal from "./IncomingCallModal";
import CallScreen from "./CallScreen";
import { useChatAI } from "../../features/chat-ai/hooks/useChatAI";
import AIConsentModal from "../../features/chat-ai/components/AIConsentModal";
import AIActionPanel from "../../features/chat-ai/components/AIActionPanel";
import AIResultPanel from "../../features/chat-ai/components/AIResultPanel";
import type { MessagePreviewDTO } from "../../features/chat-ai/types/chatAI";

interface ChatWindowProps {
    conversationId: number;
    userId: number;
    onMarkAsRead?: (conversationId: number) => void;
    onToggleInfoPanel?: () => void;
    showInfoPanel?: boolean;
}

function createClientFileId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatWindow({
    conversationId,
    userId,
    onMarkAsRead,
    onToggleInfoPanel,
    showInfoPanel = true,
}: ChatWindowProps) {
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

    const {
        conversation,
        membersById,
        messages,
        pinnedMessages,
        loading,
        loadingMore,
        sending,
        uploading,
        uploadProgressPercent,
        uploadProgressLabel,
        uploadFileProgressMap,
        uploadFailedFileNames,
        error,

        displayName,
        displayAvatar,

        messageText,
        setMessageText,

        messagesEndRef,
        messagesContainerRef,

        showScrollToBottomButton,
        pendingNewMessages,

        isHistoricalMode,
        handleJumpToMessage,
        handleScroll,
        handleScrollToBottomClick,
        handleSend,
        handleSendMixedMedia,
        handlePinMessage,
        handleUnpinMessage,
        handleRecall,
        handleDeleteMessageForMe,
        appendRealtimeMessage,
        scrollToBottom,
        recallToast,

        isRecording,
        recordingDuration,
        startRecording,
        stopRecording,
        cancelRecording,

        defaultAvatarUrl,
        defaultAvatarSmallUrl,

        isNearBottom,
        isInitialLoad,
        shouldScrollOnMediaLoad,
        shouldForceAutoScroll,
        stabilizeMediaLayoutOnMediaLoad,

        readReceipts,
        typingUsers,
        sendTypingSignal,
    } = useChatWindowController({ conversationId, userId, onMarkAsRead });

    const otherMember = useMemo(
        () => Object.values(membersById).find((m) => m.userId !== userId),
        [membersById, userId],
    );

    const targetMemberIds = useMemo(
        () =>
            Object.values(membersById)
                .filter((m) => m.userId !== userId)
                .map((m) => m.userId),
        [membersById, userId],
    );

    const {
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        remoteStreams,
        callDurationText,
        micEnabled,
        cameraEnabled,
        isScreenSharing,
        canToggleCamera,
        canShareScreen,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endCall,
        toggleMic,
        toggleCamera,
        toggleScreenShare,
    } = useCall({
        conversationId,
        userId,
        targetUserIds: targetMemberIds,
        targetUserId: otherMember?.userId,
        targetName: otherMember?.nickname,
        targetAvatar: otherMember?.avatar,
        onCallMessageSaved: appendRealtimeMessage,
    });

    const {
        consentLoading,
        consentModalOpen,
        summary,
        suggestions,
        aiError,
        isSummarizing,
        isSuggesting,
        acceptAIConsent,
        declineAIConsent,
        summarizeConversation,
        suggestReplies,
    } = useChatAI({ conversationId });

    const callParticipants = useMemo(() => {
        if (!activeCall || conversation?.type !== "GROUP") return [];

        const callMemberIds = new Set<number>(activeCall.remoteUserIds);

        if (!activeCall.isCaller) {
            callMemberIds.add(userId);
        }

        return Object.values(membersById)
            .filter((member) => callMemberIds.has(member.userId))
            .map((member) => ({
                userId: member.userId,
                name: member.nickname || member.username,
                avatar: member.avatar,
            }));
    }, [activeCall, conversation?.type, membersById, userId]);

    // UI state cho khu vực banner ghim:
    // - false: hiển thị dạng gọn (1 item chính)
    // - true: bung danh sách các item ghim còn lại
    const [showPinnedList, setShowPinnedList] = useState(false);
    const [openPinnedMenuId, setOpenPinnedMenuId] = useState<string | null>(
        null,
    );

    const pinnedBannerItems = useMemo(() => {
        // Chuẩn hoá text preview theo loại tin nhắn để banner dễ đọc.
        const previewText = (message: (typeof messages)[number]) => {
            if (message.type === "IMAGE") return "[Hình ảnh]";
            if (message.type === "VIDEO") return "[Video]";
            if (message.type === "AUDIO") return "[Tin nhắn thoại]";
            if (message.type === "FILE") return "[Tệp đính kèm]";
            if (message.type === "CALL") return "[Cuộc gọi]";
            return message.content || "Tin nhắn";
        };

        return pinnedMessages.map((pin) => {
            const matchedMessage = messages.find(
                (message) => message.id === pin.messageId,
            );

            // Hiển thị tên người gửi của tin nhắn gốc đang được ghim.
            // Nếu không tìm thấy member thì fallback về chuỗi chung để UI không bị rỗng.
            const originalSender = matchedMessage
                ? membersById[matchedMessage.senderId]
                : undefined;
            const senderName = originalSender?.nickname || "Người dùng";

            // Nếu tin ghim là ảnh thì hiện thumbnail nhỏ trong banner/list.
            const thumbUrl =
                matchedMessage?.type === "IMAGE"
                    ? matchedMessage.content
                    : undefined;

            return {
                ...pin,
                preview: matchedMessage
                    ? previewText(matchedMessage)
                    : "Tin nhắn đã ghim",
                thumbUrl,
                senderName,
            };
        });
    }, [membersById, messages, pinnedMessages]);

    // Item ghim đầu tiên luôn hiển thị ở banner dạng gọn.
    const primaryPinnedItem = pinnedBannerItems[0];
    const hiddenPinnedItems = pinnedBannerItems.slice(1);
    const hiddenPinnedCount = hiddenPinnedItems.length;
    const canExpandPinnedList = hiddenPinnedCount > 0;

    useEffect(() => {
        if (!canExpandPinnedList && showPinnedList) {
            setShowPinnedList(false);
        }
    }, [canExpandPinnedList, showPinnedList]);

    useEffect(() => {
        function handlePinnedMenuOutside(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (target.closest("[data-pin-menu='true']")) return;
            setOpenPinnedMenuId(null);
        }

        document.addEventListener("mousedown", handlePinnedMenuOutside);
        return () =>
            document.removeEventListener("mousedown", handlePinnedMenuOutside);
    }, []);

    const [plusMenuOpen, setPlusMenuOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [replyToMessage, setReplyToMessage] = useState<{
        id: string;
        senderName: string;
        content: string;
    } | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<
        string | null
    >(null);
    const [jumpRequestToken, setJumpRequestToken] = useState(0);
    const plusMenuRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const pendingJumpMessageIdRef = useRef<string | null>(null);
    const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>(
        {},
    );
    const [selectedFiles, setSelectedFiles] = useState<
        Array<{ id: string; file: File }>
    >([]);
    const [selectedImagePreviewUrls, setSelectedImagePreviewUrls] = useState<
        Record<string, string>
    >({});
    const selectedImagePreviewUrlsRef = useRef<Record<string, string>>({});

    useEffect(() => {
        if (!plusMenuOpen) return;
        function handleOutside(e: MouseEvent) {
            if (
                plusMenuRef.current &&
                !plusMenuRef.current.contains(e.target as Node)
            ) {
                setPlusMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [plusMenuOpen]);

    // Click outside để đóng emoji picker
    useEffect(() => {
        if (!emojiPickerOpen) return;
        function handleOutside(e: MouseEvent) {
            if (
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(e.target as Node)
            ) {
                setEmojiPickerOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [emojiPickerOpen]);

    // Handle emoji click
    const onEmojiClick = useCallback(
        (emojiData: EmojiClickData) => {
            setMessageText((prev) => prev + emojiData.emoji);
            messageInputRef.current?.focus();
        },
        [setMessageText],
    );

    // Refs cho hidden file inputs (Đính kèm file / Chọn GIF)
    const attachInputRef = useRef<HTMLInputElement>(null);
    const gifInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);

    const handleApplySuggestion = useCallback(
        (suggestion: string) => {
            setMessageText(suggestion);
            requestAnimationFrame(() => {
                messageInputRef.current?.focus();
            });
        },
        [setMessageText],
    );

    const onFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const incoming = Array.from(e.target.files ?? []);
            if (incoming.length === 0) return;

            setSelectedFiles((prev) => [
                ...prev,
                ...incoming.map((file) => ({
                    id: createClientFileId(),
                    file,
                })),
            ]);
            e.target.value = ""; // reset để cho phép chọn lại cùng file

            // Giữ trải nghiệm chat liên tục: chọn file xong vẫn focus vào ô nhập.
            requestAnimationFrame(() => {
                messageInputRef.current?.focus();
            });
        },
        [],
    );

    const selectedFileItems = useMemo(
        () =>
            selectedFiles.map((item) => ({
                key: item.id,
                file: item.file,
                isImage: item.file.type.startsWith("image/"),
            })),
        [selectedFiles],
    );

    const removeSelectedFile = useCallback((key: string) => {
        setSelectedFiles((prev) => prev.filter((item) => item.id !== key));
    }, []);

    useEffect(() => {
        setSelectedImagePreviewUrls((prev) => {
            const next = { ...prev };

            for (const [key, url] of Object.entries(next)) {
                const stillUsed = selectedFileItems.some(
                    (item) => item.key === key && item.isImage,
                );
                if (!stillUsed) {
                    URL.revokeObjectURL(url);
                    delete next[key];
                }
            }

            for (const item of selectedFileItems) {
                if (!item.isImage) continue;
                if (!next[item.key]) {
                    next[item.key] = URL.createObjectURL(item.file);
                }
            }

            return next;
        });
    }, [selectedFileItems]);

    useEffect(() => {
        selectedImagePreviewUrlsRef.current = selectedImagePreviewUrls;
    }, [selectedImagePreviewUrls]);

    useEffect(() => {
        return () => {
            for (const url of Object.values(
                selectedImagePreviewUrlsRef.current,
            )) {
                URL.revokeObjectURL(url);
            }
        };
    }, []);

    const getMessagePreviewText = useCallback(
        (message: (typeof messages)[number]) => {
            if (message.type === "IMAGE") return "[Hình ảnh]";
            if (message.type === "VIDEO") return "[Video]";
            if (message.type === "AUDIO") return "[Tin nhắn thoại]";
            if (message.type === "FILE") return "[Tệp đính kèm]";
            if (message.type === "CALL") return "[Cuộc gọi]";
            return message.content || "Tin nhắn";
        },
        [],
    );

    const handleReplyMessage = useCallback(
        (message: (typeof messages)[number]) => {
            const sender = membersById[message.senderId];
            setReplyToMessage({
                id: message.id,
                senderName: sender?.nickname || "Người dùng",
                content: getMessagePreviewText(message),
            });

            // Click menu có thể làm input blur, nên refocus ở frame kế tiếp.
            requestAnimationFrame(() => {
                messageInputRef.current?.focus();
            });
        },
        [getMessagePreviewText, membersById],
    );

    const focusAndHighlightMessage = useCallback(
        (messageId: string): boolean => {
            const tryHighlight = (attempt: number) => {
                const target = messageElementRefs.current[messageId];
                if (!target) {
                    if (attempt < 12) {
                        requestAnimationFrame(() => tryHighlight(attempt + 1));
                    }
                    return;
                }

                target.scrollIntoView({ behavior: "smooth", block: "center" });
                setHighlightedMessageId(messageId);

                setTimeout(() => {
                    setHighlightedMessageId((prev) =>
                        prev === messageId ? null : prev,
                    );
                }, 2400);
            };

            requestAnimationFrame(() => tryHighlight(0));
            return true;
        },
        [],
    );

    const requestJumpToMessage = useCallback(
        async (messageId: string) => {
            pendingJumpMessageIdRef.current = messageId;

            const jumpOk = await handleJumpToMessage(messageId);
            if (!jumpOk) {
                pendingJumpMessageIdRef.current = null;
                return;
            }

            setJumpRequestToken((token) => token + 1);
        },
        [handleJumpToMessage],
    );

    // Click vào item ghim ở banner/list sẽ cuộn tới đúng tin gốc trong đoạn chat.
    const handleOpenPinnedMessage = useCallback(
        (messageId: string) => {
            void requestJumpToMessage(messageId);
        },
        [requestJumpToMessage],
    );

    // Focus vào input khi component mount hoặc chuyển conversation
    useEffect(() => {
        // Timeout nhỏ để đảm bảo input đã render xong
        const timer = setTimeout(() => {
            messageInputRef.current?.focus();
        }, 100);

        return () => clearTimeout(timer);
    }, [conversationId]);

    // Focus vào input sau khi gửi tin nhắn thành công
    useEffect(() => {
        if (!sending && !uploading) {
            messageInputRef.current?.focus();
        }
    }, [sending, uploading]);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    };

    // ====== Render messages theo nhóm ngày (Zalo-style) ======
    // Yêu cầu:
    // - Nhãn ngày nằm giữa luồng chat
    // - Xuất hiện trước tin nhắn đầu tiên của ngày đó
    // - Nội dung: Hôm nay / Hôm qua / dd/MM / dd/MM/yyyy (nếu khác năm)
    // - Mỗi ngày chỉ hiển thị 1 lần
    //
    // Ghi chú: logic này giả định `messages` được sắp theo thời gian tăng dần
    // (tin cũ -> tin mới) để nhãn ngày hiển thị đúng vị trí.
    const messageItems = useMemo(() => {
        const items: ReactNode[] = [];
        const messageById = new Map(messages.map((msg) => [msg.id, msg]));

        // Chuẩn hoá về "đầu ngày" (00:00) để so sánh hôm nay/hôm qua chính xác.
        const startOfDay = (d: Date) =>
            new Date(d.getFullYear(), d.getMonth(), d.getDate());

        // Format nhãn ngày theo quy tắc sản phẩm.
        const formatDateLabel = (date: Date) => {
            const now = new Date();
            const todayStart = startOfDay(now);
            const dateStart = startOfDay(date);

            const diffDays = Math.round(
                (todayStart.getTime() - dateStart.getTime()) /
                    (1000 * 60 * 60 * 24),
            );

            if (diffDays === 0) return "Hôm nay";
            if (diffDays === 1) return "Hôm qua";

            const dd = String(date.getDate()).padStart(2, "0");
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const yyyy = date.getFullYear();

            if (yyyy !== now.getFullYear()) return `${dd}/${mm}/${yyyy}`;
            return `${dd}/${mm}`;
        };

        // Khoá ngày ổn định để phát hiện "tin nhắn đầu tiên của ngày".
        const getDayKey = (date: Date) =>
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        let previousDayKey: string | null = null;

        for (let idx = 0; idx < messages.length; idx++) {
            const message = messages[idx];
            const prevMsg = messages[idx - 1];
            const nextMsg = messages[idx + 1];
            const stableMessageKey =
                message.id ||
                `${message.senderId}-${message.createdAt || "unknown"}-${idx}`;

            const createdAt = new Date(message.createdAt);
            const validDate = Number.isFinite(createdAt.getTime());
            const dayKey = validDate ? getDayKey(createdAt) : "invalid-date";

            // Nhãn ngày: chỉ chèn khi "đổi ngày" so với message trước đó.
            if (dayKey !== previousDayKey) {
                items.push(
                    <div
                        key={`date-sep-${stableMessageKey}-${dayKey}`}
                        className="flex justify-center py-2 mt-4 first:mt-0"
                    >
                        <div className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-100 text-xs">
                            {validDate ? formatDateLabel(createdAt) : ""}
                        </div>
                    </div>,
                );
                previousDayKey = dayKey;
            }

            // Tính group: cùng người gửi & cùng ngày → gộp nhóm
            const prevDayKey = prevMsg
                ? getDayKey(new Date(prevMsg.createdAt))
                : null;
            const nextDayKey = nextMsg
                ? getDayKey(new Date(nextMsg.createdAt))
                : null;

            const isFirstInGroup =
                !prevMsg ||
                prevMsg.senderId !== message.senderId ||
                prevDayKey !== dayKey;

            const isLastInGroup =
                !nextMsg ||
                nextMsg.senderId !== message.senderId ||
                nextDayKey !== dayKey;

            // Tin nhắn: dùng MessageBubble để handle recalled state + hover menu.
            const isOwn = message.senderId === userId;

            // Kiểm tra xem tin nhắn này có được ghim không
            const isPinned = pinnedMessages.some(
                (pin) => pin.messageId === message.id,
            );

            const senderInfo = membersById[message.senderId];
            const senderName = senderInfo?.nickname || "Người dùng";
            const senderAvatar = senderInfo?.avatar;

            const repliedSenderId = message.replyInfo?.senderId;
            const repliedSender =
                typeof repliedSenderId === "number"
                    ? membersById[repliedSenderId]
                    : undefined;
            const repliedMessage = message.replyInfo?.messageId
                ? messageById.get(message.replyInfo.messageId)
                : undefined;
            const repliedAttachment = Array.isArray(repliedMessage?.attachments)
                ? repliedMessage.attachments[0]
                : undefined;

            const replyInfoContent = (message.replyInfo?.content || "").trim();
            const repliedMessageContent = (
                repliedMessage?.content || ""
            ).trim();
            const resolvedReplyContent =
                replyInfoContent ||
                repliedAttachment?.url ||
                repliedMessageContent ||
                "Tin nhắn";

            const repliedAttachmentMeta = repliedAttachment as
                | (typeof repliedAttachment & Record<string, unknown>)
                | undefined;
            const resolvedReplyThumbnailUrl =
                (typeof repliedAttachmentMeta?.thumbnailUrl === "string" &&
                    repliedAttachmentMeta.thumbnailUrl) ||
                (typeof repliedAttachmentMeta?.thumbnail === "string" &&
                    repliedAttachmentMeta.thumbnail) ||
                undefined;
            const resolvedReplyPosterUrl =
                (typeof repliedAttachmentMeta?.posterUrl === "string" &&
                    repliedAttachmentMeta.posterUrl) ||
                (typeof repliedAttachmentMeta?.poster === "string" &&
                    repliedAttachmentMeta.poster) ||
                undefined;

            // Luôn hiện tên người gửi tin gốc được reply
            const repliedSenderName = repliedSender?.nickname || "Người dùng";

            const replyPreview = message.replyInfo
                ? {
                      messageId: message.replyInfo.messageId,
                      senderId: repliedSenderId,
                      senderName: repliedSenderName,
                      content: resolvedReplyContent,
                      type: message.replyInfo.type || repliedMessage?.type,
                      fileName: repliedAttachment?.fileName,
                      mimeType: repliedAttachment?.type,
                      thumbnailUrl: resolvedReplyThumbnailUrl,
                      posterUrl: resolvedReplyPosterUrl,
                  }
                : null;

            // Tìm các read receipts có lastMessageId trùng với tin nhắn này
            // Chỉ hiển thị cho tin nhắn KHÔNG bị thu hồi và là tin của mình
            const receiptsForThisMessage =
                isOwn && !message.isRecalled
                    ? readReceipts.filter((r) => r.lastMessageId === message.id)
                    : [];

            items.push(
                <div
                    key={stableMessageKey}
                    data-message-id={message.id}
                    className={isFirstInGroup ? "mt-3" : "mt-2"}
                    ref={(element) => {
                        messageElementRefs.current[message.id] = element;
                    }}
                >
                    <MessageBubble
                        message={message}
                        isOwn={isOwn}
                        senderName={senderName}
                        senderAvatar={senderAvatar}
                        replyPreview={replyPreview}
                        currentUserId={userId}
                        conversationType={conversation?.type}
                        defaultAvatarSmallUrl={defaultAvatarSmallUrl}
                        isPinned={isPinned}
                        onPin={(messageId) => void handlePinMessage(messageId)}
                        onUnpin={(messageId) =>
                            void handleUnpinMessage(messageId)
                        }
                        onReply={handleReplyMessage}
                        onJumpToMessage={requestJumpToMessage}
                        onRecall={handleRecall}
                        onRecallCall={(callType) => void startCall(callType)}
                        onDeleteForMe={handleDeleteMessageForMe}
                        onMediaLoad={() => {
                            stabilizeMediaLayoutOnMediaLoad();
                            // Chỉ cuộn xuống cuối khi:
                            // 1. Đang trong giai đoạn initial load (F5/mở chat)
                            // 2. User đang ở gần cuối (đang xem tin mới)
                            // 3. Vừa nhận tin nhắn mới IMAGE/VIDEO (flag được set trong handleNewMessage)
                            // KHÔNG dùng isOwn vì sẽ gây scroll khi load tin cũ từ pagination
                            if (
                                isInitialLoad() ||
                                isNearBottom() ||
                                shouldScrollOnMediaLoad()
                            ) {
                                scrollToBottom(
                                    shouldForceAutoScroll() ? "auto" : "smooth",
                                );
                            }
                        }}
                        isHighlighted={highlightedMessageId === message.id}
                        isFirstInGroup={isFirstInGroup}
                        isLastInGroup={isLastInGroup}
                    />

                    {/* Read Receipt Avatars - hiển thị avatar "đã xem" bên dưới tin nhắn */}
                    {receiptsForThisMessage.length > 0 && (
                        <div className="flex justify-end mt-1 mr-1 gap-1">
                            {receiptsForThisMessage.map((receipt) => {
                                // Lấy thông tin member từ conversation
                                const member = membersById[receipt.userId];
                                return (
                                    <img
                                        key={receipt.userId}
                                        src={
                                            member?.avatar ||
                                            defaultAvatarSmallUrl
                                        }
                                        alt={member?.nickname || "User"}
                                        title={`Đã xem bởi ${member?.nickname || "User"}`}
                                        className="w-4 h-4 rounded-full object-cover border border-white dark:border-gray-800"
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>,
            );
        }

        return items;
    }, [
        conversation?.type,
        defaultAvatarSmallUrl,
        handlePinMessage,
        handleDeleteMessageForMe,
        handleReplyMessage,
        handleRecall,
        highlightedMessageId,
        isInitialLoad,
        isNearBottom,
        membersById,
        messageElementRefs,
        shouldScrollOnMediaLoad,
        messages,
        readReceipts,
        requestJumpToMessage,
        scrollToBottom,
        startCall,
        userId,
    ]);

    const currentMessagesForAISummary = useMemo<MessagePreviewDTO[]>(() => {
        const recentMessages = messages.slice(-100);

        return recentMessages.reduce<MessagePreviewDTO[]>((result, message) => {
            const previewContent = getMessagePreviewText(message);
            if (!previewContent?.trim()) {
                return result;
            }

            result.push({
                senderRole: message.senderId === userId ? "me" : "other",
                content: previewContent,
                createdAt: message.createdAt,
            });

            return result;
        }, []);
    }, [messages, userId, getMessagePreviewText]);

    useEffect(() => {
        const pendingId = pendingJumpMessageIdRef.current;
        if (!pendingId) return;

        const focused = focusAndHighlightMessage(pendingId);
        if (focused) {
            pendingJumpMessageIdRef.current = null;
        }
    }, [focusAndHighlightMessage, jumpRequestToken, messageItems.length]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Đang tải...</p>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">
                    {error || "Không tìm thấy cuộc trò chuyện"}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-gray-700 px-5 py-3.5 bg-white dark:bg-black backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <img
                        src={displayAvatar || defaultAvatarUrl}
                        alt={displayName}
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                    />
                    <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Active now
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white disabled:opacity-40"
                        onClick={() => void startCall("audio")}
                        disabled={!otherMember}
                        title="Gọi thoại"
                    >
                        <Phone size={18} />
                    </button>
                    <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white disabled:opacity-40"
                        onClick={() => void startCall("video")}
                        disabled={!otherMember}
                        title="Gọi video"
                    >
                        <Video size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onToggleInfoPanel}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            showInfoPanel
                                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        }`}
                        title={
                            showInfoPanel ? "Ẩn thông tin" : "Hiện thông tin"
                        }
                    >
                        <Info size={18} />
                    </button>
                </div>
            </div>

            {pinnedBannerItems.length > 0 && (
                <div className="bg-gray-50 px-2.5 py-2 border-b border-gray-200 dark:bg-black dark:border-[#262626]">
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm dark:border-[#303030] dark:bg-gray-900">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-gray-800 dark:text-blue-300">
                            <MessageCircle size={16} />
                        </span>

                        {primaryPinnedItem && (
                            <button
                                type="button"
                                onClick={() =>
                                    handleOpenPinnedMessage(
                                        primaryPinnedItem.messageId,
                                    )
                                }
                                className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="Đi tới tin nhắn đã ghim"
                            >
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Tin nhắn
                                </p>
                                <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-medium text-gray-700 dark:text-gray-200">
                                        {primaryPinnedItem.senderName}:
                                    </span>{" "}
                                    {primaryPinnedItem.preview}
                                </p>
                            </button>
                        )}

                        {canExpandPinnedList && (
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPinnedList((prev) => !prev)
                                }
                                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-[#3a3a3a] dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                                title={
                                    showPinnedList
                                        ? "Thu gọn danh sách ghim"
                                        : "Mở danh sách ghim"
                                }
                                aria-expanded={showPinnedList}
                                aria-label="Hiện danh sách tin nhắn ghim"
                            >
                                <span>+{hiddenPinnedCount} ghim</span>
                                <ChevronDown
                                    size={14}
                                    className={`transition-transform ${showPinnedList ? "rotate-180" : "rotate-0"}`}
                                />
                            </button>
                        )}

                        {primaryPinnedItem && (
                            <div
                                className="relative shrink-0"
                                data-pin-menu="true"
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const key = `${primaryPinnedItem.messageId}-${primaryPinnedItem.pinnedAt}`;
                                        setOpenPinnedMenuId((prev) =>
                                            prev === key ? null : key,
                                        );
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                    title="Tùy chọn ghim"
                                >
                                    <MoreVertical size={16} />
                                </button>

                                {openPinnedMenuId ===
                                    `${primaryPinnedItem.messageId}-${primaryPinnedItem.pinnedAt}` && (
                                    <div className="absolute right-0 top-full mt-1 min-w-24 rounded-lg border border-gray-200 dark:border-[#303030] bg-white dark:bg-gray-900 shadow-lg z-20 py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenPinnedMenuId(null);
                                                void handleUnpinMessage(
                                                    primaryPinnedItem.messageId,
                                                );
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            Bỏ ghim
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {showPinnedList && canExpandPinnedList && (
                        <div className="mt-2 space-y-1.5">
                            {hiddenPinnedItems.map((pin) => (
                                <div
                                    key={`${pin.messageId}-${pin.pinnedAt}`}
                                    className="w-full flex items-center gap-1"
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleOpenPinnedMessage(
                                                pin.messageId,
                                            )
                                        }
                                        className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left text-xs text-gray-800 hover:bg-gray-50 dark:border-[#303030] dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                                    >
                                        {pin.thumbUrl ? (
                                            <img
                                                src={pin.thumbUrl}
                                                alt="Ảnh ghim"
                                                className="h-9 w-9 rounded object-cover shrink-0"
                                            />
                                        ) : (
                                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-blue-600 dark:text-blue-400">
                                                <MessageCircle size={16} />
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <p className="truncate text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                                {pin.senderName}
                                            </p>
                                            <p className="truncate text-xs">
                                                {pin.preview}
                                            </p>
                                        </div>
                                    </button>

                                    <div
                                        className="relative shrink-0"
                                        data-pin-menu="true"
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const key = `${pin.messageId}-${pin.pinnedAt}`;
                                                setOpenPinnedMenuId((prev) =>
                                                    prev === key ? null : key,
                                                );
                                            }}
                                            className="h-7 w-7 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title="Tùy chọn ghim"
                                        >
                                            <MoreVertical size={14} />
                                        </button>

                                        {openPinnedMenuId ===
                                            `${pin.messageId}-${pin.pinnedAt}` && (
                                            <div className="absolute right-0 top-full mt-1 min-w-24 rounded-lg border border-gray-200 dark:border-[#303030] bg-white dark:bg-gray-900 shadow-lg z-20 py-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOpenPinnedMenuId(
                                                            null,
                                                        );
                                                        void handleUnpinMessage(
                                                            pin.messageId,
                                                        );
                                                    }}
                                                    className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                >
                                                    Bỏ ghim
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="relative flex-1 min-h-0">
                {error && (
                    <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-gray-200 dark:border-gray-700">
                        {error}
                    </div>
                )}

                {/* Toast thu hồi: hiện 2s rồi tự biến mất */}
                {recallToast && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-gray-800 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                        {recallToast}
                    </div>
                )}

                <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="relative h-full overflow-y-auto p-4 pb-4 flex flex-col"
                    style={{ overflowAnchor: "none" }}
                >
                    {/* Loading more indicator (hiện khi kéo lên load tin cũ) */}
                    {loadingMore && (
                        <div
                            className="pointer-events-none absolute top-2 left-0 right-0 z-10 flex justify-center"
                            style={{ overflowAnchor: "none" }}
                        >
                            <div className="inline-flex items-center rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm px-3 py-2">
                                <span className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-200 animate-spin" />
                            </div>
                        </div>
                    )}

                    {messageItems}

                    {/* Typing Indicator - Dummy message bubble khi có người đang gõ */}
                    {typingUsers.size > 0 && (
                        <div className="flex items-end gap-2 mt-3">
                            {/* Avatar của người đang gõ */}
                            {Array.from(typingUsers).map((typingUserId) => {
                                const typingMember = membersById[typingUserId];
                                return (
                                    <img
                                        key={typingUserId}
                                        src={
                                            typingMember?.avatar ||
                                            defaultAvatarSmallUrl
                                        }
                                        alt={typingMember?.nickname || "User"}
                                        className="w-7 h-7 rounded-full object-cover"
                                    />
                                );
                            })}
                            {/* Bubble với 3 chấm nhấp nháy */}
                            <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl px-3 py-3 max-w-20">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} className="h-1 scroll-mb-6" />
                </div>

                {/* Nút cuộn xuống cuối (Messenger/Zalo style) */}
                {(showScrollToBottomButton ||
                    (isHistoricalMode && !isNearBottom())) && (
                    <button
                        type="button"
                        onClick={handleScrollToBottomClick}
                        className="absolute bottom-4 right-4 h-11 w-11 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 z-20"
                        aria-label={
                            isHistoricalMode
                                ? "Trở về hiện tại"
                                : "Cuộn xuống tin nhắn mới nhất"
                        }
                        title={
                            isHistoricalMode
                                ? "Trở về hiện tại"
                                : "Cuộn xuống tin nhắn mới nhất"
                        }
                    >
                        <ArrowDown
                            size={18}
                            className="text-gray-700 dark:text-gray-200"
                        />

                        {pendingNewMessages > 0 && (
                            <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] leading-5 text-center">
                                {pendingNewMessages > 99
                                    ? "99+"
                                    : pendingNewMessages}
                            </span>
                        )}
                    </button>
                )}
            </div>

            <div className=" bg-white dark:bg-black px-4 pb-0.5 pt-1.5">
                <AIActionPanel
                    isOpen={isAiPanelOpen}
                    onToggle={() => setIsAiPanelOpen((prev) => !prev)}
                    disabled={uploading || sending}
                    isSummarizing={isSummarizing}
                    isSuggesting={isSuggesting}
                    onSummarize={() => {
                        void summarizeConversation(currentMessagesForAISummary);
                    }}
                    onSuggest={() => {
                        void suggestReplies();
                    }}
                />
                {isAiPanelOpen && (
                    <AIResultPanel
                        summary={summary}
                        suggestions={suggestions}
                        error={aiError}
                        isSummarizing={isSummarizing}
                        isSuggesting={isSuggesting}
                        onSuggestionClick={handleApplySuggestion}
                    />
                )}
            </div>

            {/* Input */}
            <div className=" bg-white px-4 pb-3.5 pt-2.5 dark:border-gray-700/70 dark:bg-black">
                {/* Hidden file inputs */}
                <input
                    ref={attachInputRef}
                    type="file"
                    accept="*/*"
                    multiple
                    className="hidden"
                    onChange={onFileChange}
                />
                <input
                    ref={gifInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={onFileChange}
                />

                {isRecording ? (
                    /* Recording overlay */
                    <div className="flex items-center gap-3 px-2 py-1">
                        {/* Pulsing red dot */}
                        <span className="shrink-0 h-3 w-3 rounded-full bg-red-500 animate-pulse" />

                        {/* Duration */}
                        <span className="text-sm font-mono text-red-500 w-12 shrink-0">
                            {formatDuration(recordingDuration)}
                        </span>

                        {/* Label */}
                        <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                            Đang ghi âm...
                        </span>

                        {/* Cancel */}
                        <button
                            type="button"
                            onClick={cancelRecording}
                            title="Huỷ"
                            className="shrink-0 p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                        >
                            <X size={22} />
                        </button>

                        {/* Stop & send */}
                        <button
                            type="button"
                            onClick={stopRecording}
                            title="Dừng và gửi"
                            className="shrink-0 p-1.5 text-white bg-blue-500 hover:bg-blue-600 rounded-full"
                        >
                            <Square size={20} fill="currentColor" />
                        </button>
                    </div>
                ) : (
                    <div>
                        {selectedFileItems.length > 0 && (
                            <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
                                {selectedFileItems.map((item) => (
                                    <div
                                        key={item.key}
                                        className="relative shrink-0"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeSelectedFile(item.key)
                                            }
                                            className="absolute -top-2 -right-2 z-10 h-5 w-5 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 flex items-center justify-center text-gray-600 dark:text-gray-200"
                                            title="Xóa tệp"
                                        >
                                            <X size={12} />
                                        </button>

                                        {item.isImage ? (
                                            <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                                {selectedImagePreviewUrls[
                                                    item.key
                                                ] ? (
                                                    <img
                                                        src={
                                                            selectedImagePreviewUrls[
                                                                item.key
                                                            ]
                                                        }
                                                        alt={item.file.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="h-full w-full block bg-gray-100 dark:bg-gray-800" />
                                                )}

                                                {uploading && (
                                                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/40 dark:bg-black/30">
                                                        <span
                                                            className="block h-full bg-blue-500 transition-all duration-150"
                                                            style={{
                                                                width: `${uploadFileProgressMap[item.key] ?? 0}%`,
                                                            }}
                                                        />
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-16 min-w-40 max-w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 flex items-center gap-2">
                                                <span className="h-8 w-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0">
                                                    <Paperclip size={14} />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs text-gray-700 dark:text-gray-200">
                                                        {item.file.name}
                                                    </span>
                                                    {uploading && (
                                                        <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                                                            {uploadFileProgressMap[
                                                                item.key
                                                            ] ?? 0}
                                                            %
                                                        </span>
                                                    )}
                                                    {!uploading &&
                                                        uploadFailedFileNames.includes(
                                                            item.file.name,
                                                        ) && (
                                                            <span className="block text-[10px] text-red-500">
                                                                Upload lỗi
                                                            </span>
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {uploading && uploadProgressPercent !== null && (
                            <div className="mb-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2">
                                <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                    <span>
                                        {uploadProgressLabel || "Đang tải tệp"}
                                    </span>
                                    <span>{uploadProgressPercent}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-150"
                                        style={{
                                            width: `${uploadProgressPercent}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {replyToMessage && (
                            <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                        Trả lời {replyToMessage.senderName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {replyToMessage.content}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setReplyToMessage(null)}
                                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            {/* Plus / X — mở popup menu */}
                            <div
                                ref={plusMenuRef}
                                className="relative shrink-0"
                            >
                                <button
                                    type="button"
                                    onClick={() => setPlusMenuOpen((v) => !v)}
                                    disabled={uploading}
                                    className="rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {plusMenuOpen ? (
                                        <X size={21} />
                                    ) : (
                                        <Plus size={21} />
                                    )}
                                </button>

                                {/* Popup menu */}
                                {plusMenuOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl py-1.5 w-72 z-40">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPlusMenuOpen(false);
                                                void startRecording();
                                            }}
                                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <Mic
                                                size={20}
                                                className="text-gray-700 dark:text-gray-300 shrink-0"
                                            />
                                            <span className="text-sm text-gray-800 dark:text-gray-100">
                                                Gửi clip âm thanh
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPlusMenuOpen(false);
                                                attachInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <Paperclip
                                                size={20}
                                                className="text-gray-700 dark:text-gray-300 shrink-0"
                                            />
                                            <span className="text-sm text-gray-800 dark:text-gray-100">
                                                Đính kèm file (tối đa 100MB)
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPlusMenuOpen(false)
                                            }
                                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 opacity-50 cursor-not-allowed"
                                        >
                                            <StickyNote
                                                size={20}
                                                className="text-gray-700 dark:text-gray-300 shrink-0"
                                            />
                                            <span className="text-sm text-gray-800 dark:text-gray-100">
                                                Chọn nhãn dán
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPlusMenuOpen(false);
                                                gifInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <Film
                                                size={20}
                                                className="text-gray-700 dark:text-gray-300 shrink-0"
                                            />
                                            <span className="text-sm text-gray-800 dark:text-gray-100">
                                                Chọn file GIF / Ảnh / Video
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1.5 transition-colors focus-within:bg-gray-50 dark:bg-gray-900 dark:focus-within:bg-gray-800">
                                {/* Input text */}
                                <input
                                    ref={messageInputRef}
                                    type="text"
                                    value={messageText}
                                    onChange={(e) => {
                                        setMessageText(e.target.value);
                                        // Gửi typing signal
                                        if (e.target.value.trim()) {
                                            sendTypingSignal(true);
                                        } else {
                                            sendTypingSignal(false);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" &&
                                            !sending &&
                                            !uploading
                                        ) {
                                            sendTypingSignal(false); // Ngừng typing khi gửi
                                            if (selectedFiles.length > 0) {
                                                void handleSendMixedMedia(
                                                    selectedFiles.map(
                                                        (item) => item.file,
                                                    ),
                                                    undefined,
                                                    replyToMessage?.id,
                                                ).then((ok) => {
                                                    if (!ok) return;
                                                    setSelectedFiles([]);
                                                    setReplyToMessage(null);
                                                });
                                            } else {
                                                void handleSend(
                                                    undefined,
                                                    replyToMessage?.id,
                                                ).then(() =>
                                                    setReplyToMessage(null),
                                                );
                                            }
                                        }
                                    }}
                                    onBlur={() => sendTypingSignal(false)} // Ngừng typing khi blur
                                    placeholder={
                                        uploading
                                            ? "Đang tải file lên..."
                                            : "Nhập tin nhắn..."
                                    }
                                    disabled={sending || uploading}
                                    className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder-gray-400 disabled:opacity-50"
                                />

                                {/* Uploading spinner */}
                                {uploading && (
                                    <span className="shrink-0 h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-700 dark:border-t-gray-200 animate-spin" />
                                )}

                                {/* Emoji — luôn hiện (trừ khi đang upload) */}
                                {!uploading && (
                                    <div
                                        ref={emojiPickerRef}
                                        className="relative"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEmojiPickerOpen(
                                                    !emojiPickerOpen,
                                                )
                                            }
                                            className={`shrink-0 rounded-full p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 ${
                                                emojiPickerOpen
                                                    ? "text-blue-500"
                                                    : "text-gray-800 dark:text-gray-200"
                                            }`}
                                        >
                                            <Smile size={21} />
                                        </button>

                                        {/* Emoji Picker Popup */}
                                        {emojiPickerOpen && (
                                            <div
                                                ref={emojiPickerRef}
                                                className="absolute bottom-full right-0 mb-2 z-50 emoji-picker-custom"
                                            >
                                                <EmojiPicker
                                                    onEmojiClick={onEmojiClick}
                                                    theme={
                                                        document.documentElement.classList.contains(
                                                            "dark",
                                                        )
                                                            ? Theme.DARK
                                                            : Theme.LIGHT
                                                    }
                                                    width={350}
                                                    height={435}
                                                    searchPlaceholder="Tìm kiếm biểu tượng cảm xúc"
                                                    previewConfig={{
                                                        showPreview: false,
                                                    }}
                                                    emojiStyle={
                                                        EmojiStyle.FACEBOOK
                                                    }
                                                    skinTonesDisabled
                                                    lazyLoadEmojis
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Thumbs up khi trống, Send khi có text */}
                            {!uploading &&
                                (messageText.trim() ||
                                selectedFiles.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedFiles.length > 0) {
                                                void handleSendMixedMedia(
                                                    selectedFiles.map(
                                                        (item) => item.file,
                                                    ),
                                                    undefined,
                                                    replyToMessage?.id,
                                                ).then((ok) => {
                                                    if (!ok) return;
                                                    setSelectedFiles([]);
                                                    setReplyToMessage(null);
                                                });
                                                return;
                                            }

                                            void handleSend(
                                                undefined,
                                                replyToMessage?.id,
                                            ).then(() =>
                                                setReplyToMessage(null),
                                            );
                                        }}
                                        disabled={sending}
                                        className="shrink-0 rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
                                    >
                                        <Send size={22} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleSend(
                                                "👍",
                                                replyToMessage?.id,
                                            ).then(() =>
                                                setReplyToMessage(null),
                                            )
                                        }
                                        disabled={sending}
                                        className="shrink-0 rounded-full p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                                    >
                                        <Emoji
                                            unified="1f44d"
                                            size={28}
                                            emojiStyle={EmojiStyle.APPLE}
                                        />
                                    </button>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            <IncomingCallModal
                open={Boolean(incomingCall)}
                callerName={
                    (incomingCall?.fromUserId
                        ? membersById[incomingCall.fromUserId]?.nickname
                        : undefined) ||
                    `Người dùng ${incomingCall?.fromUserId ?? ""}`
                }
                callType={incomingCall?.callType || "audio"}
                onAccept={() => void acceptIncomingCall()}
                onReject={rejectIncomingCall}
            />

            <AIConsentModal
                open={consentModalOpen}
                loading={consentLoading}
                error={aiError}
                onAccept={() => {
                    void acceptAIConsent();
                }}
                onDecline={declineAIConsent}
            />

            <CallScreen
                open={Boolean(activeCall)}
                callType={activeCall?.callType || "audio"}
                remoteName={
                    activeCall?.remoteName ||
                    otherMember?.nickname ||
                    "Người dùng"
                }
                remoteAvatar={activeCall?.remoteAvatar || otherMember?.avatar}
                status={activeCall?.status || "calling"}
                durationText={callDurationText}
                localStream={localStream}
                remoteStream={remoteStream}
                remoteStreams={remoteStreams}
                participants={callParticipants}
                micEnabled={micEnabled}
                cameraEnabled={cameraEnabled}
                isScreenSharing={isScreenSharing}
                canToggleCamera={canToggleCamera}
                canShareScreen={canShareScreen}
                onToggleMic={toggleMic}
                onToggleCamera={toggleCamera}
                onToggleScreenShare={() => void toggleScreenShare()}
                onEndCall={() => void endCall()}
            />
        </div>
    );
}
