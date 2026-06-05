import React from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    Modal,
    Pressable,
    ScrollView,
    Animated,
    StyleSheet,
    Linking,
    Platform,
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import * as Haptics from "expo-haptics";
import {
    PanGestureHandler,
    State,
    type PanGestureHandlerGestureEvent,
    type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { UserAvatar, ReactionDetailModal } from "@/components";
import { colors, spacing } from "@/constants";
import { Message, Conversation, PollResponse } from "@/types/chat";
import chatService from "@/services/chatService";
import { type MembersByUserId } from "@/stores/chatRuntimeStore";
import {
    isSystemMessageType,
    formatMessageTime,
    resolveAttachmentUrls,
    parseCallMeta,
    isLikelyStoragePathOrUrl,
    resolveMediaUrl,
    inferReplyPreviewType,
    normalizeSearchText,
    isEmojiOnlyText,
    resolvePinSystemPreview,
    getFileBadgeLabel,
    formatFileSize,
    formatDurationMillis,
    MediaViewerState,
    PinSystemRunRenderMeta,
    formatReplyLabel,
} from "@/utils/messageUtils";
import { buildSystemGroupMessage } from "@/utils/systemCreateGroupMessage";
import { extractGroupInviteToken } from "@/utils/groupInvite";
import { LOCKED_ACCOUNT_NAME } from "@/utils/lockedAccount";

const RIGHT_SCROLL_CUE_HEIGHT = 38;
const MESSAGE_LONG_PRESS_DELAY_MS = 500;
const SWIPE_REPLY_TRIGGER_PX = 56;
const SWIPE_REPLY_MAX_TRANSLATE_PX = 72;
const LONG_TEXT_PREVIEW_LENGTH = 900;
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderTextWithLinks(content: string, mine: boolean) {
    const parts = content.split(URL_PATTERN);
    return parts.map((part, index) => {
        if (!/^https?:\/\/[^\s]+$/.test(part)) {
            return part;
        }

        return (
            <Text
                key={`${part}-${index}`}
                style={[
                    styles.inlineLink,
                    mine && styles.inlineLinkMine,
                ]}
                onPress={() => {
                    void Linking.openURL(part);
                }}
            >
                {part}
            </Text>
        );
    });
}

const GROUP_SYSTEM_MESSAGE_TYPES = new Set<Message["type"]>([
    "SYSTEM_POLL_CREATED",
    "SYSTEM_POLL_VOTED",
    "SYSTEM_POLL_CHANGED",
    "SYSTEM_POLL_CLOSED",
    "SYSTEM_POLL_PINNED",
    "SYSTEM_CREATE_GROUP",
    "SYSTEM_ADD_MEMBER",
    "SYSTEM_UPDATE_ROLE",
    "SYSTEM_KICK_MEMBER",
    "SYSTEM_BLOCK_MEMBER",
    "SYSTEM_MEMBER_BLOCKED_FROM_JOIN",
    "SYSTEM_LEAVE_GROUP",
    "SYSTEM_DISBAND_GROUP",
    "SYSTEM_UPDATE_SETTING",
    "SYSTEM_REQUIRE_APPROVAL",
    "SYSTEM_JOIN_VIA_LINK",
    "SYSTEM_GROUP_INVITE_LINK_SENT",
]);

function isPollSystemType(type: Message["type"]): boolean {
    return type.startsWith("SYSTEM_POLL_");
}

function isAnonymousPollActorMessage(type: Message["type"]): boolean {
    return type === "SYSTEM_POLL_VOTED" || type === "SYSTEM_POLL_CHANGED";
}

function buildPollSystemText(type: Message["type"], title?: string | null, actorLabel = "Bạn"): string {
    const pollTitle = title?.trim() || "bình chọn";
    switch (type) {
        case "SYSTEM_POLL_CREATED":
            return `${actorLabel} tạo cuộc bình chọn mới: ${pollTitle}`;
        case "SYSTEM_POLL_VOTED":
            return `${actorLabel} tham gia cuộc bình chọn: ${pollTitle}`;
        case "SYSTEM_POLL_CHANGED":
            return `${actorLabel} đổi lựa chọn trong cuộc bình chọn: ${pollTitle}`;
        case "SYSTEM_POLL_CLOSED":
            return `${actorLabel} khóa bình chọn: ${pollTitle}`;
        case "SYSTEM_POLL_PINNED":
            return `${actorLabel} ghim bình chọn: ${pollTitle}`;
        default:
            return pollTitle;
    }
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
        ? "Hôm nay"
        : `ngày ${date.toLocaleDateString("vi-VN")}`;
    return `${ended ? "Đã kết thúc lúc" : "Kết thúc lúc"} ${time} ${dayLabel}`;
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
    return sameDay ? "Hôm nay" : `ngày ${date.toLocaleDateString("vi-VN")}`;
}

export type MessageBubbleProps = {
    item: Message;
    index: number;
    messages: Message[];
    currentUserId: number;
    membersById: MembersByUserId;
    conversation: Conversation | null;
    readReceipts: any[]; // Using any[] to bypass readReceipts since the actual type wasn't exported easily
    pinRunMeta: PinSystemRunRenderMeta | undefined;
    highlightedMessageId: string | null;
    setMediaViewer: (viewer: MediaViewerState | null) => void;
    handleMessageLongPress: (
        event: any,
        messageId: string,
        mine: boolean,
    ) => void;
    requestJumpToMessage: (messageId: string) => Promise<void>;
    handleExpandPinSystemRun: (runKey: string) => void;
    audioPlayback: any;
    isPinned?: boolean;
    onPinMessage?: (messageId: string) => Promise<void>;
    onUnpinMessage?: (messageId: string) => Promise<void>;
    onRecallCall?: (callType: "audio" | "video") => void;
    onSwipeReply?: (message: Message) => void;
};

export const MessageBubble = React.memo(
    ({
        item,
        index,
        messages,
        currentUserId,
        membersById,
        conversation,
        readReceipts,
        pinRunMeta,
        highlightedMessageId,
        setMediaViewer,
        handleMessageLongPress,
        requestJumpToMessage,
        handleExpandPinSystemRun,
        audioPlayback,
        isPinned = false,
        onPinMessage,
        onUnpinMessage,
        onRecallCall,
        onSwipeReply,
    }: MessageBubbleProps) => {
        const router = useRouter();
        const [reactionDetailVisible, setReactionDetailVisible] = React.useState(false);
        const [pollModalOpen, setPollModalOpen] = React.useState(false);
        const [pollDetailOpen, setPollDetailOpen] = React.useState(false);
        const [pollSettingsOpen, setPollSettingsOpen] = React.useState(false);
        const [pollDraftOptionIds, setPollDraftOptionIds] = React.useState<string[]>([]);
        const [localPoll, setLocalPoll] = React.useState<PollResponse | null>(
            item.poll ?? null,
        );
        const [pollUpdating, setPollUpdating] = React.useState(false);
        const [pollAddingOption, setPollAddingOption] = React.useState(false);
        const [pollClosing, setPollClosing] = React.useState(false);
        const [pollOptionDraft, setPollOptionDraft] = React.useState("");
        const [, setPollClockTick] = React.useState(0);
        const [textExpanded, setTextExpanded] = React.useState(false);
        const pollSelectionByIdRef = React.useRef<Record<string, string[]>>({});

        React.useEffect(() => {
            if (!item.poll) {
                setLocalPoll(null);
                return;
            }
            const rememberedSelection = pollSelectionByIdRef.current[item.poll.id];
            setLocalPoll({
                ...item.poll,
                currentUserOptionIds:
                    rememberedSelection ?? item.poll.currentUserOptionIds ?? [],
            });
        }, [item.poll]);

        React.useEffect(() => {
            if (!localPoll?.expiresAt || isPollExpired(localPoll)) return;
            const timeout = setTimeout(
                () => setPollClockTick((value) => value + 1),
                Math.max(250, new Date(localPoll.expiresAt).getTime() - Date.now() + 250),
            );
            return () => clearTimeout(timeout);
        }, [localPoll]);

        React.useEffect(() => {
            if (!pollModalOpen || !localPoll) return;
            setPollDraftOptionIds(localPoll.currentUserOptionIds ?? []);
            setPollSettingsOpen(false);
            setPollDetailOpen(false);
        }, [localPoll, pollModalOpen]);

        const togglePollDraftOption = React.useCallback(
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

        const submitPollDraft = React.useCallback(async () => {
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
                setPollModalOpen(false);
                setPollSettingsOpen(false);
            } finally {
                setPollUpdating(false);
            }
        }, [localPoll, pollDraftOptionIds, pollUpdating]);

        const handleAddPollOption = React.useCallback(async () => {
            const poll = localPoll;
            const optionText = pollOptionDraft.trim();
            if (!poll || !optionText || pollAddingOption || poll.closed || poll.recalled || isPollExpired(poll)) {
                return;
            }
            const duplicated = poll.options.some(
                (option) => option.text.trim().toLowerCase() === optionText.toLowerCase(),
            );
            if (duplicated) {
                Alert.alert("Lua chon bi trung", "Moi lua chon phai khac nhau.");
                return;
            }

            setPollAddingOption(true);
            try {
                const updated = await chatService.addPollOption(poll.id, optionText);
                setLocalPoll(updated);
                setPollOptionDraft("");
            } finally {
                setPollAddingOption(false);
            }
        }, [localPoll, pollAddingOption, pollOptionDraft]);

        const handleClosePoll = React.useCallback(() => {
            const poll = localPoll;
            if (!poll || pollClosing || poll.closed || poll.recalled || isPollExpired(poll)) return;
            Alert.alert(
                "Khoa binh chon?",
                "Sau khi khoa, thanh vien se khong the tiep tuc tham gia binh chon.",
                [
                    { text: "Khong", style: "cancel" },
                    {
                        text: "Khoa",
                        style: "destructive",
                        onPress: () => {
            setPollClosing(true);
            chatService.closePoll(poll.id)
                .then((updated) => {
                    setLocalPoll(updated);
                    setPollSettingsOpen(false);
                })
                .finally(() => setPollClosing(false));
                        },
                    },
                ],
            );
        }, [localPoll, pollClosing]);

        const handlePinPoll = React.useCallback(async () => {
            try {
                if (isPinned) {
                    if (onUnpinMessage) {
                        await onUnpinMessage(item.id);
                    } else {
                        await chatService.unpinMessage(item.id, currentUserId);
                    }
                } else if (onPinMessage) {
                    await onPinMessage(item.id);
                } else {
                    await chatService.pinMessage(item.id, currentUserId);
                }
                setPollSettingsOpen(false);
            } catch {
                Alert.alert("Không thể ghim bình chọn", "Vui lòng thử lại sau.");
            }
        }, [currentUserId, isPinned, item.id, onPinMessage, onUnpinMessage]);

        const openPollModalFromSystem = React.useCallback(async () => {
            if (localPoll) {
                setPollModalOpen(true);
                return;
            }
            if (!item.pollId) {
                if (item.replyInfo?.messageId) {
                    await requestJumpToMessage(item.replyInfo.messageId);
                }
                return;
            }
            try {
                const poll = await chatService.getPoll(item.pollId);
                setLocalPoll(poll);
                setPollModalOpen(true);
            } catch {
                Alert.alert("Không thể mở bình chọn", "Vui lòng thử lại sau.");
            }
        }, [item.pollId, item.replyInfo?.messageId, localPoll, requestJumpToMessage]);
        const {
            audioLoadingKey,
            playingAudioKey,
            activePressAudioKey,
            activeSeekAudioKey,
            audioProgressMap,
            toggleAudioPlayback,
            handleAudioPressIn,
            handleAudioPressOut,
            handleSeekInteractionStart,
            seekAudioByLocation,
            handleSeekInteractionEnd,
            getAudioWaveBars,
            combinedAudioIconScale,
            setAudioTrackWidthMap,
            audioSeekScale,
            audioPlayPulse,
            audioPressScale,
            audioIconFade,
        } = audioPlayback;

        const mine = item.senderId === currentUserId;
        const sender = membersById[item.senderId];
        // 1 user có đang bị khóa tài khoản không. DIRECT: mọi người không phải
        // mình đều là đối phương -> bám directPartnerLocked (tươi từ DB),
        // không phụ thuộc cache members.
        const isUserAccountLocked = React.useCallback(
            (uid?: number | null) => {
                if (uid == null || Number.isNaN(Number(uid))) return false;
                if (membersById[Number(uid)]?.accountLocked) return true;
                return (
                    conversation?.type === "DIRECT" &&
                    Boolean(conversation?.directPartnerLocked) &&
                    Number(uid) !== Number(currentUserId)
                );
            },
            [membersById, conversation?.type, conversation?.directPartnerLocked, currentUserId],
        );
        const senderLocked = isUserAccountLocked(item.senderId);
        const senderDisplayName = senderLocked
            ? LOCKED_ACCOUNT_NAME
            : sender?.nickname || sender?.username || "Nguoi dung";
        const currentMemberRole = membersById[currentUserId]?.role;
        const canManageCurrentPoll =
            Boolean(localPoll) &&
            (localPoll?.creatorId === currentUserId ||
                currentMemberRole === "OWNER" ||
                currentMemberRole === "DEPUTY");
        const pollCreator = localPoll?.creatorId
            ? membersById[localPoll.creatorId]
            : undefined;
        const pollCreatorName =
            Number(localPoll?.creatorId) === Number(currentUserId)
                ? "Bạn"
                : isUserAccountLocked(localPoll?.creatorId)
                  ? LOCKED_ACCOUNT_NAME
                  : pollCreator?.nickname || pollCreator?.username || senderDisplayName;
        const pollCreatedDayLabel = formatContextDay(localPoll?.createdAt || item.createdAt);
        const getPollMember = React.useCallback(
            (userId: number) => membersById[userId],
            [membersById],
        );
        const getPollMemberName = React.useCallback(
            (userId: number) => {
                if (Number(userId) === Number(currentUserId)) return "Bạn";
                if (isUserAccountLocked(userId)) return LOCKED_ACCOUNT_NAME;
                const member = getPollMember(userId);
                return member?.nickname || member?.username || `Người dùng ${userId}`;
            },
            [currentUserId, getPollMember, isUserAccountLocked],
        );
        const renderPollAvatarStack = React.useCallback(
            (voterIds?: number[]) => {
                const ids = (voterIds ?? []).map(Number).filter(Boolean);
                if (ids.length === 0) return null;
                const visibleIds = ids.slice(0, 3);
                const hiddenCount = ids.length - visibleIds.length;

                return (
                    <View style={styles.pollAvatarStack}>
                        {visibleIds.map((voterId, avatarIndex) => {
                            const member = getPollMember(voterId);
                            return (
                                <View
                                    key={`${voterId}-${avatarIndex}`}
                                    style={[
                                        styles.pollAvatarWrap,
                                        avatarIndex > 0 && styles.pollAvatarOverlap,
                                    ]}
                                >
                                    <UserAvatar
                                        uri={member?.avatar}
                                        name={getPollMemberName(voterId)}
                                        size={22}
                                        locked={isUserAccountLocked(voterId)}
                                    />
                                </View>
                            );
                        })}
                        {hiddenCount > 0 ? (
                            <View style={[styles.pollAvatarMore, visibleIds.length > 0 && styles.pollAvatarOverlap]}>
                                <Text style={styles.pollAvatarMoreText}>+{hiddenCount}</Text>
                            </View>
                        ) : null}
                    </View>
                );
            },
            [getPollMember, getPollMemberName, isUserAccountLocked],
        );

        // ===== Gesture handling (từ develop) =====
        const suppressNextTapRef = React.useRef(false);
        const swipeTranslateX = React.useRef(new Animated.Value(0)).current;

        const triggerMessageLongPress = React.useCallback(
            (event: any) => {
                suppressNextTapRef.current = true;
                handleMessageLongPress(event, item.id, mine);
            },
            [handleMessageLongPress, item.id, mine],
        );

        const runTapAction = React.useCallback((action: () => void) => {
            if (suppressNextTapRef.current) {
                suppressNextTapRef.current = false;
                return;
            }
            action();
        }, []);

        const swipeReplyTranslateX = swipeTranslateX.interpolate({
            inputRange: mine
                ? [-SWIPE_REPLY_MAX_TRANSLATE_PX, 0]
                : [0, SWIPE_REPLY_MAX_TRANSLATE_PX],
            outputRange: mine
                ? [-SWIPE_REPLY_MAX_TRANSLATE_PX, 0]
                : [0, SWIPE_REPLY_MAX_TRANSLATE_PX],
            extrapolate: "clamp",
        });
        const swipeReplyCueProgress = swipeTranslateX.interpolate({
            inputRange: mine
                ? [-SWIPE_REPLY_TRIGGER_PX, -18]
                : [18, SWIPE_REPLY_TRIGGER_PX],
            outputRange: mine ? [1, 0] : [0, 1],
            extrapolate: "clamp",
        });
        const handleSwipeGesture = React.useMemo(
            () =>
                Animated.event<PanGestureHandlerGestureEvent>(
                    [{ nativeEvent: { translationX: swipeTranslateX } }],
                    { useNativeDriver: true },
                ),
            [swipeTranslateX],
        );
        const resetSwipeReply = React.useCallback(() => {
            Animated.spring(swipeTranslateX, {
                toValue: 0,
                damping: 18,
                stiffness: 260,
                mass: 0.75,
                useNativeDriver: true,
            }).start();
        }, [swipeTranslateX]);
        const handleSwipeStateChange = React.useCallback(
            (event: PanGestureHandlerStateChangeEvent) => {
                const { state, translationX, translationY } = event.nativeEvent;
                if (
                    state !== State.END &&
                    state !== State.CANCELLED &&
                    state !== State.FAILED
                ) {
                    return;
                }

                const movedInReplyDirection = mine
                    ? translationX <= -SWIPE_REPLY_TRIGGER_PX
                    : translationX >= SWIPE_REPLY_TRIGGER_PX;
                const mostlyHorizontal =
                    Math.abs(translationX) > Math.abs(translationY) * 1.25;

                if (movedInReplyDirection && mostlyHorizontal) {
                    void Haptics.selectionAsync();
                    onSwipeReply?.(item);
                    suppressNextTapRef.current = true;
                }

                resetSwipeReply();
            },
            [item, mine, onSwipeReply, resetSwipeReply],
        );

        // ===== Audio long press timer (từ develop) =====
        const audioWaveLongPressTimerRef = React.useRef<ReturnType<
            typeof setTimeout
        > | null>(null);
        const audioWaveLongPressTriggeredRef = React.useRef(false);

        const clearAudioWaveLongPressTimer = React.useCallback(() => {
            if (!audioWaveLongPressTimerRef.current) return;
            clearTimeout(audioWaveLongPressTimerRef.current);
            audioWaveLongPressTimerRef.current = null;
        }, []);

        React.useEffect(() => {
            return () => {
                clearAudioWaveLongPressTimer();
            };
        }, [clearAudioWaveLongPressTimer]);

        // ===== previous/next message (từ feature/call-mobile - có skip SYSTEM_PIN) =====
        const previousMessage = index > 0 ? messages[index - 1] : undefined;
        const nextMessage =
            index + 1 < messages.length ? messages[index + 1] : undefined;

        // ===== grouping logic (common, nhưng dùng previous/next từ feature) =====
        const isFirstInGroup =
            !previousMessage || 
            previousMessage.senderId !== item.senderId ||
            previousMessage.type.startsWith("SYSTEM_");

        const isLastInGroup =
            !nextMessage || 
            nextMessage.senderId !== item.senderId ||
            nextMessage.type.startsWith("SYSTEM_");

        const isConsecutiveRecalledInGroup =
            !isFirstInGroup &&
            item.isRecalled &&
            Boolean(previousMessage?.isRecalled) &&
            previousMessage?.senderId === item.senderId;

        // ===== UI flags (common) =====
        const isPollMessage = item.type === "POLL";
        const showSenderLabel =
            !isPollMessage &&
            !mine &&
            conversation?.type === "GROUP" &&
            isFirstInGroup &&
            !item.isRecalled;

        const showAvatar = !isPollMessage && !mine && isLastInGroup;

        const messageTime = !isPollMessage ? formatMessageTime(item.createdAt) : '';

        // ===== read receipts (common) =====
        const receiptsForThisMessage =
            mine && !item.isRecalled
                ? readReceipts.filter((receipt) => {
                      if (receipt.userId === currentUserId) return false;
                      if (receipt.lastMessageId === item.id) return true;

                      const readIndex = messages.findIndex(
                          (message) => message.id === receipt.lastMessageId,
                      );
                      if (readIndex < 0 || readIndex < index) return false;

                      const latestOwnReadableIndex = messages
                          .slice(0, readIndex + 1)
                          .map((message, messageIndex) => ({
                              message,
                              messageIndex,
                          }))
                          .filter(
                              ({ message }) =>
                                  Number(message.senderId) ===
                                      Number(currentUserId) &&
                                  !message.isRecalled,
                          )
                          .at(-1)?.messageIndex;

                      return latestOwnReadableIndex === index;
                  })
                : [];

        // ===== media handling =====
        const imageUrls =
            item.type === "IMAGE" ? resolveAttachmentUrls(item) : [];
        const conversationImageUrls = React.useMemo(
            () =>
                messages.flatMap((message) =>
                    message.type === "IMAGE"
                        ? resolveAttachmentUrls(message)
                        : [],
                ),
            [messages],
        );

        const videoUrls =
            item.type === "VIDEO" ? resolveAttachmentUrls(item) : [];

        // ===== audioAttachments (từ develop - nâng cấp hơn audioUrls) =====
        const audioAttachments =
            item.type === "AUDIO"
                ? Array.isArray(item.attachments) && item.attachments.length > 0
                    ? item.attachments
                          .map((attachment) => ({
                              url:
                                  resolveMediaUrl(attachment.url) ||
                                  attachment.url,
                              mimeType: attachment.type,
                          }))
                          .filter((attachment) => Boolean(attachment.url))
                    : resolveAttachmentUrls(item).map((url) => ({
                          url,
                          mimeType: undefined,
                      }))
                : [];

        // ===== call meta (common) =====
        const callMeta = parseCallMeta(item);

        // ===== file attachments (common) =====
        const rawFileAttachments =
            item.type === "FILE"
                ? Array.isArray(item.attachments) && item.attachments.length > 0
                    ? item.attachments
                    : isLikelyStoragePathOrUrl(item.content)
                      ? [
                            {
                                url: item.content ?? "",
                                fileName:
                                    (item.content ?? "").split("/").pop() ||
                                    "Tep dinh kem",
                            },
                        ]
                      : []
                : [];

        const fileAttachments = rawFileAttachments.map((attachment) => ({
            ...attachment,
            resolvedUrl: resolveMediaUrl(attachment.url) || attachment.url,
        }));
        const replySenderName =
            typeof item.replyInfo?.senderId === "number"
                ? isUserAccountLocked(item.replyInfo.senderId)
                    ? LOCKED_ACCOUNT_NAME
                    : membersById[item.replyInfo.senderId]?.nickname ||
                      membersById[item.replyInfo.senderId]?.username ||
                      "Nguoi dung"
                : "Nguoi dung";

        const replyPreviewType = inferReplyPreviewType(item.replyInfo);
        const replyPreviewContent = item.replyInfo?.content?.trim() ?? "";
        const normalizedReplyPreviewContent =
            normalizeSearchText(replyPreviewContent);
        const isReplyPreviewRecalled =
            normalizedReplyPreviewContent.includes("thu hoi") ||
            normalizedReplyPreviewContent.includes("da bi go bo") ||
            normalizedReplyPreviewContent.includes("da duoc go bo");
        const isReplyMedia =
            replyPreviewType === "IMAGE" || replyPreviewType === "VIDEO";
        const replyPreviewImageUrl =
            isReplyMedia && isLikelyStoragePathOrUrl(replyPreviewContent)
                ? resolveMediaUrl(replyPreviewContent)
                : "";
        const isFullMediaReply =
            !!replyPreviewImageUrl && !isReplyPreviewRecalled;
        const hasReplyLeadingVisual =
            !isReplyPreviewRecalled &&
            (replyPreviewType === "IMAGE" ||
                replyPreviewType === "VIDEO" ||
                replyPreviewType === "AUDIO" ||
                replyPreviewType === "CALL");
        const replyPreviewText = isReplyPreviewRecalled
            ? "Tin nhan da duoc thu hoi"
            : replyPreviewType === "IMAGE"
              ? ""
              : replyPreviewType === "VIDEO"
                ? ""
                : replyPreviewType === "AUDIO"
                  ? "Tin nhan thoai"
                  : replyPreviewType === "FILE"
                    ? "File dinh kem"
                    : replyPreviewType === "CALL"
                      ? "Cuoc goi"
                      : replyPreviewContent || "Tin nhan";
        const trimmedContent = item.content?.trim() ?? "";
        const shouldCollapseText =
            item.type === "TEXT" &&
            !item.isRecalled &&
            (item.content?.length ?? 0) > LONG_TEXT_PREVIEW_LENGTH;
        const visibleTextContent =
            shouldCollapseText && !textExpanded && item.content
                ? `${item.content.slice(0, LONG_TEXT_PREVIEW_LENGTH).trimEnd()}...`
                : item.content;
        const groupInviteToken =
            (item.type === "TEXT" || item.type === "LINK") && !item.isRecalled
                ? extractGroupInviteToken(trimmedContent, {
                      allowRawToken: false,
                  })
                : null;
        const messageIsEmojiOnly =
            item.type === "TEXT" &&
            !item.isRecalled &&
            isEmojiOnlyText(trimmedContent);
        const shouldShowFallbackText =
            !item.isRecalled &&
            item.type !== "IMAGE" &&
            item.type !== "FILE" &&
            item.type !== "VIDEO" &&
            item.type !== "AUDIO" &&
            item.type !== "POLL" &&
            item.type !== "CALL" &&
            item.type !== "LINK" &&
            item.type !== "SYSTEM_PIN" &&
            item.type !== "SYSTEM_UPIN" &&
            !GROUP_SYSTEM_MESSAGE_TYPES.has(item.type) &&
            !groupInviteToken;

        const shouldShowAttachmentCaption =
            !item.isRecalled &&
            (item.type === "IMAGE" ||
                item.type === "FILE" ||
                item.type === "VIDEO" ||
                item.type === "AUDIO") &&
            trimmedContent.length > 0 &&
            !isLikelyStoragePathOrUrl(trimmedContent);

        // ===== CALL logic (từ develop - quan trọng) =====
        const isRichCardMessage =
            !item.isRecalled &&
            (Boolean(groupInviteToken) ||
                item.type === "IMAGE" ||
                item.type === "FILE" ||
                item.type === "VIDEO" ||
                item.type === "AUDIO" ||
                item.type === "POLL" ||
                item.type === "CALL");

        const isCallMessage = !item.isRecalled && item.type === "CALL";

        // ===== reply overlay (từ develop - fix cho CALL) =====
        const hasReplyPreview = Boolean(item.replyInfo) && !item.isRecalled;

        const shouldOverlayReplyWithBubble =
            hasReplyPreview && (!isRichCardMessage || isCallMessage);
        const replySenderId = item.replyInfo?.senderId;
        const replyMessageId = item.replyInfo?.messageId ?? "";
        // ===== bubble grouping (từ develop + fix CALL) =====
        const bubbleGroupShape =
            !isRichCardMessage || isCallMessage
                ? mine
                    ? isFirstInGroup
                        ? isLastInGroup
                            ? styles.bubbleMineSingle
                            : styles.bubbleMineFirst
                        : isLastInGroup
                          ? styles.bubbleMineLast
                          : styles.bubbleMineMiddle
                    : isFirstInGroup
                      ? isLastInGroup
                          ? styles.bubbleOtherSingle
                          : styles.bubbleOtherFirst
                      : isLastInGroup
                        ? styles.bubbleOtherLast
                        : styles.bubbleOtherMiddle
                : null;

        // ===== system message handling (grouping & rendering) =====
        const isSystemMessage = isSystemMessageType(item.type);
        const isPinSystemMessage = item.type === "SYSTEM_PIN" || item.type === "SYSTEM_UPIN";

        if (isSystemMessage) {
            if (pinRunMeta?.shouldHideMessage) {
                return null;
            }

            if (pinRunMeta?.shouldRenderCollapsedButton) {
                return (
                    <View style={styles.systemMessageRow}>
                        <Pressable
                            style={styles.systemCollapsedBtn}
                            onPress={() =>
                                handleExpandPinSystemRun(pinRunMeta.runKey)
                            }
                        >
                            <Ionicons
                                name="time-outline"
                                size={13}
                                color={colors.primary}
                            />
                            <Text style={styles.systemCollapsedBtnText}>
                                {`Xem cập nhật trước (${pinRunMeta.runLength})`}
                            </Text>
                        </Pressable>
                    </View>
                );
            }

            if (isPinSystemMessage) {
                const actorLabel = mine ? "Bạn" : senderDisplayName;
                const actionLabel = item.type === "SYSTEM_UPIN" ? "" : "ghim";

                return (
                    <View style={styles.systemMessageRow}>
                        <View style={styles.systemMessageBadge}>
                            <Ionicons
                                name="pin-outline"
                                size={12}
                                color={colors.primary}
                            />
                            <Text
                                numberOfLines={1}
                                style={styles.systemMessageText}
                            >
                                {`${actorLabel} ${actionLabel} ${resolvePinSystemPreview(item)}`}
                            </Text>
                        </View>
                    </View>
                );
            }

            if (isPollSystemType(item.type)) {
                const pollMessageId = item.replyInfo?.messageId;
                const pollActorLabel =
                    isAnonymousPollActorMessage(item.type) && Number(item.senderId) <= 0
                        ? "Một thành viên"
                        : mine
                          ? "Bạn"
                          : senderDisplayName;

                return (
                    <>
                        <View style={styles.systemMessageRow}>
                            <View style={styles.systemPollBadge}>
                                <Ionicons
                                    name="stats-chart-outline"
                                    size={13}
                                    color={colors.primary}
                                />
                                <Text style={styles.systemMessageText}>
                                    {buildPollSystemText(item.type, item.content, pollActorLabel)}
                                    {pollMessageId ? (
                                        <Text
                                            onPress={() => {
                                                void openPollModalFromSystem();
                                            }}
                                            style={styles.systemPollLink}
                                        >
                                            {"  "}Xem
                                        </Text>
                                    ) : null}
                                </Text>
                            </View>
                        </View>
                        {localPoll ? (
                            <Modal
                                visible={pollModalOpen}
                                transparent
                                animationType="fade"
                                onRequestClose={() => setPollModalOpen(false)}
                            >
                                <View style={styles.pollModalOverlay}>
                                    <View style={styles.pollModalCard}>
                                        <View style={styles.pollModalHeader}>
                                            <Text style={styles.pollModalTitle}>Bình chọn</Text>
                                            <Pressable
                                                onPress={() => {
                                                    setPollModalOpen(false);
                                                    setPollSettingsOpen(false);
                                                }}
                                                hitSlop={8}
                                                style={styles.pollHeaderIconButton}
                                            >
                                                <Ionicons name="close" size={22} color="#111827" />
                                            </Pressable>
                                        </View>
                                        <ScrollView
                                            style={styles.pollModalBody}
                                            contentContainerStyle={styles.pollModalBodyContent}
                                            keyboardShouldPersistTaps="handled"
                                        >
                                            {(() => {
                                                const pollEnded =
                                                    localPoll.closed ||
                                                    localPoll.recalled ||
                                                    isPollExpired(localPoll);
                                                const endLabel = formatPollEndLabel(
                                                    localPoll.expiresAt || (pollEnded ? localPoll.updatedAt : null),
                                                    pollEnded,
                                                );
                                                const totalVoters =
                                                    localPoll.totalVoterCount ?? localPoll.totalVoteCount;

                                                return (
                                                    <>
                                                        <Text style={styles.pollModalQuestion}>
                                                            {localPoll.title || item.content}
                                                        </Text>
                                                        <Text style={styles.pollCreatorText}>
                                                            Tạo bởi {pollCreatorName}
                                                            {pollCreatedDayLabel ? ` · ${pollCreatedDayLabel}` : ""}
                                                        </Text>
                                                        {endLabel ? (
                                                            <View style={styles.pollMetaRow}>
                                                                <Ionicons name="time-outline" size={16} color="#4B5563" />
                                                                <Text style={styles.pollModalMeta}>{endLabel}</Text>
                                                            </View>
                                                        ) : null}
                                                        <View style={styles.pollMetaRow}>
                                                            <Ionicons name="list-outline" size={16} color="#4B5563" />
                                                            <Text style={styles.pollModalMeta}>
                                                                {localPoll.allowMultipleChoices
                                                                    ? "Chọn nhiều phương án"
                                                                    : "Chọn một phương án"}
                                                            </Text>
                                                        </View>
                                                        {localPoll.anonymous ? (
                                                            <View style={styles.pollMetaRow}>
                                                                <Ionicons name="eye-off-outline" size={16} color="#4B5563" />
                                                                <Text style={styles.pollModalMeta}>Ẩn người bình chọn</Text>
                                                            </View>
                                                        ) : null}
                                                        <Text style={styles.pollAnonymousNotice}>
                                                            {totalVoters} người bình chọn, {localPoll.totalVoteCount} lượt chọn
                                                        </Text>
                                                        {localPoll.options.map((option) => {
                                                            const selected = pollDraftOptionIds.includes(option.id);
                                                            const percent =
                                                                localPoll.totalVoteCount > 0
                                                                    ? Math.round((option.voteCount / localPoll.totalVoteCount) * 100)
                                                                    : 0;
                                                            return (
                                                                <Pressable
                                                                    key={option.id}
                                                                    disabled={pollUpdating || pollEnded}
                                                                    onPress={() => togglePollDraftOption(option.id)}
                                                                    style={[
                                                                        styles.pollOption,
                                                                        selected && styles.pollOptionSelected,
                                                                    ]}
                                                                >
                                                                    <Text numberOfLines={1} style={styles.pollOptionText}>
                                                                        {option.text}
                                                                    </Text>
                                                                    {renderPollAvatarStack(option.voterIds)}
                                                                    <Text style={styles.pollOptionCount}>
                                                                        {option.voteCount} · {percent}%
                                                                    </Text>
                                                                </Pressable>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </ScrollView>
                                        <View style={styles.pollModalFooter}>
                                            <View style={styles.pollSettingsWrap}>
                                                <Pressable
                                                    style={styles.pollSettingsButton}
                                                    onPress={() => setPollSettingsOpen((open) => !open)}
                                                >
                                                    <Ionicons name="settings-outline" size={22} color="#0F172A" />
                                                </Pressable>
                                                {pollSettingsOpen ? (
                                                    <View style={styles.pollSettingsMenu}>
                                                        <Pressable
                                                            style={styles.pollSettingsMenuItem}
                                                            onPress={() => void handlePinPoll()}
                                                        >
                                                            <Text style={styles.pollSettingsMenuText}>
                                                                {isPinned ? "Bỏ ghim" : "Ghim lên đầu trò chuyện"}
                                                            </Text>
                                                        </Pressable>
                                                        {canManageCurrentPoll &&
                                                        !localPoll.closed &&
                                                        !localPoll.recalled &&
                                                        !isPollExpired(localPoll) ? (
                                                            <Pressable
                                                                style={styles.pollSettingsMenuItem}
                                                                onPress={handleClosePoll}
                                                            >
                                                                <Text style={styles.pollSettingsMenuText}>Khóa bình chọn</Text>
                                                            </Pressable>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                            </View>
                                            {localPoll.closed || localPoll.recalled || isPollExpired(localPoll) ? (
                                                <Pressable
                                                    onPress={() => {
                                                        setPollModalOpen(false);
                                                        setPollSettingsOpen(false);
                                                    }}
                                                    style={styles.pollModalCloseButton}
                                                >
                                                    <Text style={styles.pollModalCloseButtonText}>Đóng</Text>
                                                </Pressable>
                                            ) : (
                                                <Pressable
                                                    disabled={pollUpdating}
                                                    onPress={() => void submitPollDraft()}
                                                    style={styles.pollConfirmButton}
                                                >
                                                    <Text style={styles.pollConfirmButtonText}>
                                                        {pollUpdating ? "Đang xác nhận..." : "Xác nhận"}
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </Modal>
                        ) : null}
                    </>
                );
            }

            // Group system message (Create group, Add member, etc.)
            const content = buildSystemGroupMessage({
                type: item.type as
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
                content: item.content,
                isOwn: mine,
                senderName: senderDisplayName,
                senderId: item.senderId,
                currentUserId,
                membersById,
            });

            return (
                <View style={styles.systemMessageRow}>
                    <View style={styles.systemMessageBadge}>
                        <Ionicons
                            name="people-outline"
                            size={12}
                            color={colors.primary}
                        />
                        <Text
                            numberOfLines={2}
                            style={styles.systemMessageText}
                        >
                            {content}
                        </Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.messageItemWrap}>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.swipeReplyCue,
                        mine
                            ? styles.swipeReplyCueMine
                            : styles.swipeReplyCueOther,
                        {
                            opacity: swipeReplyCueProgress,
                            transform: [
                                {
                                    scale: swipeReplyCueProgress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.72, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Ionicons
                        name={mine ? "return-up-forward" : "return-up-back"}
                        size={18}
                        color="#2563EB"
                    />
                </Animated.View>
                <PanGestureHandler
                    activeOffsetX={[-16, 16]}
                    failOffsetY={[-14, 14]}
                    onGestureEvent={handleSwipeGesture}
                    onHandlerStateChange={handleSwipeStateChange}
                >
                    <Animated.View
                        style={[
                            styles.swipeReplyRow,
                            { transform: [{ translateX: swipeReplyTranslateX }] },
                        ]}
                    >
                        <View
                            style={[
                                styles.row,
                                isFirstInGroup
                                    ? styles.rowGroupStart
                                    : styles.rowGrouped,
                                hasReplyPreview &&
                                    !isFirstInGroup &&
                                    styles.rowGroupedWithReply,
                                isConsecutiveRecalledInGroup &&
                                    styles.rowGroupedRecalled,
                                isPollMessage
                                    ? styles.rowPollCenter
                                    : mine
                                      ? styles.rowMine
                                      : styles.rowOther,
                            ]}
                        >
                            {!mine && !isPollMessage ? (
                                showAvatar ? (
                                    <UserAvatar
                                        uri={senderLocked ? undefined : sender?.avatar}
                                        name={senderLocked ? LOCKED_ACCOUNT_NAME : sender?.username ?? "?"}
                                        size={30}
                                        locked={senderLocked}
                                    />
                                ) : (
                                    <View style={styles.avatarSpacer} />
                                )
                            ) : null}

                            <View
                                style={[
                                    styles.messageColumn,
                                    isPollMessage
                                        ? styles.messageColumnPoll
                                        : mine
                                        ? styles.messageColumnMine
                                        : styles.messageColumnOther,
                                ]}
                            >
                                {showSenderLabel ? (
                                    <Text
                                        style={styles.groupSenderLabel}
                                        numberOfLines={1}
                                    >
                                        {senderDisplayName}
                                    </Text>
                                ) : null}

                                {hasReplyPreview ? (
                                    <View
                                        style={[
                                            styles.replyRelationRow,
                                            mine && styles.replyRelationRowMine,
                                        ]}
                                    >
                                        <Ionicons
                                            name="arrow-undo"
                                            size={12}
                                            color="#6B7280"
                                        />
                                        <Text
                                            style={[
                                                styles.replyRelationLabel,
                                                mine && styles.replyRelationLabelMine,
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {formatReplyLabel({
                                                currentUserId,
                                                messageSenderId: item.senderId,
                                                messageSenderName:
                                                    senderDisplayName,
                                                replySenderId,
                                                replySenderName,
                                            })}
                                        </Text>
                                    </View>
                                ) : null}

                                <Pressable
                            delayLongPress={MESSAGE_LONG_PRESS_DELAY_MS}
                            onLongPress={triggerMessageLongPress}
                        >
                            {messageIsEmojiOnly ? (
                                <Text style={styles.emojiOnlyText}>
                                    {trimmedContent}
                                </Text>
                            ) : (
                                <>
                                    {hasReplyPreview ? (
                                        <Pressable
                                            style={[
                                                isFullMediaReply
                                                    ? styles.replyPreviewFullWrap
                                                    : styles.replyPreview,
                                                styles.replyPreviewOverlay,
                                                mine &&
                                                    (isFullMediaReply
                                                        ? styles.replyPreviewFullWrapMine
                                                        : styles.replyPreviewMine),
                                                mine
                                                    ? styles.replyPreviewConnectedMine
                                                    : styles.replyPreviewConnectedOther,
                                            ]}
                                            delayLongPress={
                                                MESSAGE_LONG_PRESS_DELAY_MS
                                            }
                                            onLongPress={
                                                triggerMessageLongPress
                                            }
                                            onPress={() =>
                                                runTapAction(() => {
                                                    if (!replyMessageId) {
                                                        return;
                                                    }
                                                    void requestJumpToMessage(
                                                        replyMessageId,
                                                    );
                                                })
                                            }
                                        >
                                            {isFullMediaReply ? (
                                                <View
                                                    style={
                                                        styles.replyPreviewFullBody
                                                    }
                                                >
                                                    {replyPreviewType ===
                                                    "VIDEO" ? (
                                                        <>
                                                            <Video
                                                                source={{
                                                                    uri: replyPreviewImageUrl,
                                                                }}
                                                                style={
                                                                    styles.replyPreviewFullImage
                                                                }
                                                                resizeMode={
                                                                    ResizeMode.COVER
                                                                }
                                                                shouldPlay={
                                                                    false
                                                                }
                                                                positionMillis={
                                                                    0
                                                                }
                                                                useNativeControls={
                                                                    false
                                                                }
                                                            />
                                                            <View
                                                                style={
                                                                    styles.replyPreviewFullVideoOverlay
                                                                }
                                                            >
                                                                <Ionicons
                                                                    name="play"
                                                                    size={20}
                                                                    color="#FFF"
                                                                />
                                                            </View>
                                                        </>
                                                    ) : (
                                                        <Image
                                                            source={{
                                                                uri: replyPreviewImageUrl,
                                                            }}
                                                            style={
                                                                styles.replyPreviewFullImage
                                                            }
                                                        />
                                                    )}
                                                </View>
                                            ) : (
                                                <View
                                                    style={
                                                        styles.replyPreviewBody
                                                    }
                                                >
                                                    {replyPreviewType ===
                                                        "IMAGE" &&
                                                    !isReplyPreviewRecalled ? (
                                                        <View
                                                            style={[
                                                                styles.replyPreviewIconBox,
                                                                mine &&
                                                                    styles.replyPreviewIconBoxMine,
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name="image-outline"
                                                                size={20}
                                                                color="#4B5563"
                                                            />
                                                        </View>
                                                    ) : replyPreviewType ===
                                                          "VIDEO" &&
                                                      !isReplyPreviewRecalled ? (
                                                        <View
                                                            style={[
                                                                styles.replyPreviewIconBox,
                                                                mine &&
                                                                    styles.replyPreviewIconBoxMine,
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name="videocam-outline"
                                                                size={20}
                                                                color="#4B5563"
                                                            />
                                                        </View>
                                                    ) : replyPreviewType ===
                                                          "AUDIO" &&
                                                      !isReplyPreviewRecalled ? (
                                                        <View
                                                            style={[
                                                                styles.replyPreviewIconBox,
                                                                mine &&
                                                                    styles.replyPreviewIconBoxMine,
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name="mic-outline"
                                                                size={18}
                                                                color="#4B5563"
                                                            />
                                                        </View>
                                                    ) : replyPreviewType ===
                                                          "CALL" &&
                                                      !isReplyPreviewRecalled ? (
                                                        <View
                                                            style={[
                                                                styles.replyPreviewIconBox,
                                                                mine &&
                                                                    styles.replyPreviewIconBoxMine,
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name="call-outline"
                                                                size={17}
                                                                color="#4B5563"
                                                            />
                                                        </View>
                                                    ) : null}

                                                    {replyPreviewText ? (
                                                        <View
                                                            style={[
                                                                styles.replyPreviewTextWrap,
                                                                !hasReplyLeadingVisual &&
                                                                    styles.replyPreviewTextWrapNoLead,
                                                            ]}
                                                        >
                                                            {replyPreviewType ===
                                                                "FILE" &&
                                                            !isReplyPreviewRecalled ? (
                                                                <View
                                                                    style={
                                                                        styles.replyFileInline
                                                                    }
                                                                >
                                                                    <Text
                                                                        numberOfLines={
                                                                            1
                                                                        }
                                                                        style={[
                                                                            styles.replyContentOnly,
                                                                            mine &&
                                                                                styles.replyContentOnlyMine,
                                                                        ]}
                                                                    >
                                                                        {
                                                                            replyPreviewText
                                                                        }
                                                                    </Text>
                                                                    <Ionicons
                                                                        name="attach-outline"
                                                                        size={
                                                                            13
                                                                        }
                                                                        color="#6B7280"
                                                                    />
                                                                </View>
                                                            ) : (
                                                                <Text
                                                                    numberOfLines={
                                                                        1
                                                                    }
                                                                    style={[
                                                                        styles.replyContentOnly,
                                                                        mine &&
                                                                            styles.replyContentOnlyMine,
                                                                    ]}
                                                                >
                                                                    {
                                                                        replyPreviewText
                                                                    }
                                                                </Text>
                                                            )}
                                                        </View>
                                                    ) : null}
                                                </View>
                                            )}
                                        </Pressable>
                                    ) : null}

                                    <View
                                        style={[
                                            styles.bubble,
                                            mine
                                                ? styles.bubbleAlignMine
                                                : styles.bubbleAlignOther,
                                            highlightedMessageId === item.id &&
                                                styles.highlightedBubble,
                                            item.isRecalled
                                                ? styles.bubbleRecalled
                                                : isRichCardMessage &&
                                                    !isCallMessage
                                                  ? styles.bubblePlain
                                                  : mine
                                                    ? styles.bubbleMine
                                                    : styles.bubbleOther,
                                            bubbleGroupShape,
                                            shouldOverlayReplyWithBubble &&
                                                styles.bubbleWithReply,
                                            shouldOverlayReplyWithBubble &&
                                                (mine
                                                    ? styles.bubbleWithReplyMine
                                                    : styles.bubbleWithReplyOther),
                                            !mine &&
                                                (!isRichCardMessage ||
                                                    isCallMessage) &&
                                                styles.cardShadow,
                                        ]}
                                    >
                                        <View style={styles.bubbleMainContent}>
                                            {item.isRecalled ? (
                                                <Text
                                                    style={[
                                                        styles.messageText,
                                                        mine &&
                                                            styles.messageTextMine,
                                                        styles.recalledText,
                                                    ]}
                                                >
                                                    Tin nhan da duoc thu hoi
                                                </Text>
                                            ) : null}

                                            {imageUrls.length > 0 ? (
                                                <View style={styles.imageGrid}>
                                                    {imageUrls.slice(0, 4).map(
                                                        (url, imageIndex) => {
                                                            const remainingImages =
                                                                imageUrls.length -
                                                                4;
                                                            const showMoreBadge =
                                                                imageIndex ===
                                                                    3 &&
                                                                remainingImages >
                                                                    0;
                                                            return (
                                                            <Pressable
                                                                key={`${item.id}-image-${imageIndex}`}
                                                                delayLongPress={
                                                                    MESSAGE_LONG_PRESS_DELAY_MS
                                                                }
                                                                onLongPress={
                                                                    triggerMessageLongPress
                                                                }
                                                                onPress={() =>
                                                                    runTapAction(
                                                                        () =>
                                                                            setMediaViewer(
                                                                                {
                                                                                    type: "IMAGE",
                                                                                    url,
                                                                                    conversationId: item.conversationId,
                                                                                    items: conversationImageUrls.length > 0
                                                                                        ? conversationImageUrls
                                                                                        : imageUrls,
                                                                                    index: Math.max(
                                                                                        0,
                                                                                        conversationImageUrls.indexOf(url) >= 0
                                                                                            ? conversationImageUrls.indexOf(url)
                                                                                            : imageIndex,
                                                                                    ),
                                                                                },
                                                                            ),
                                                                    )
                                                                }
                                                            >
                                                                <Image
                                                                    source={{
                                                                        uri: url,
                                                                    }}
                                                                    style={[
                                                                        styles.imageAttachment,
                                                                        imageUrls.length ===
                                                                            1 &&
                                                                            styles.imageAttachmentLarge,
                                                                        mine
                                                                            ? styles.mediaCardMine
                                                                            : styles.mediaCardOther,
                                                                        !mine &&
                                                                            styles.cardShadow,
                                                                    ]}
                                                                />
                                                                {showMoreBadge ? (
                                                                    <View
                                                                        pointerEvents="none"
                                                                        style={
                                                                            styles.imageMoreOverlay
                                                                        }
                                                                    >
                                                                        <Text
                                                                            style={
                                                                                styles.imageMoreText
                                                                            }
                                                                        >
                                                                            +{remainingImages}
                                                                        </Text>
                                                                    </View>
                                                                ) : null}
                                                            </Pressable>
                                                            );
                                                        },
                                                    )}
                                                </View>
                                            ) : null}

                                            {videoUrls.length > 0 ? (
                                                <View style={styles.videoList}>
                                                    {videoUrls.map(
                                                        (url, videoIndex) => (
                                                            <View
                                                                key={`${item.id}-video-${videoIndex}`}
                                                                style={[
                                                                    styles.videoWrap,
                                                                    mine
                                                                        ? styles.mediaCardMine
                                                                        : styles.mediaCardOther,
                                                                    !mine &&
                                                                        styles.cardShadow,
                                                                ]}
                                                            >
                                                                <Video
                                                                    source={{
                                                                        uri: url,
                                                                    }}
                                                                    style={
                                                                        styles.videoAttachment
                                                                    }
                                                                    useNativeControls
                                                                    resizeMode={
                                                                        ResizeMode.COVER
                                                                    }
                                                                />
                                                                <Pressable
                                                                    style={
                                                                        styles.videoExpandBtn
                                                                    }
                                                                    delayLongPress={
                                                                        MESSAGE_LONG_PRESS_DELAY_MS
                                                                    }
                                                                    onLongPress={
                                                                        triggerMessageLongPress
                                                                    }
                                                                    onPress={() =>
                                                                        runTapAction(
                                                                            () =>
                                                                                setMediaViewer(
                                                                                    {
                                                                                        type: "VIDEO",
                                                                                        url,
                                                                                    },
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    <Ionicons
                                                                        name="expand-outline"
                                                                        size={
                                                                            15
                                                                        }
                                                                        color={
                                                                            colors.white
                                                                        }
                                                                    />
                                                                </Pressable>
                                                            </View>
                                                        ),
                                                    )}
                                                </View>
                                            ) : null}

                                            {audioAttachments.length > 0 ? (
                                                <View style={styles.audioList}>
                                                    {audioAttachments.map(
                                                        (
                                                            attachment,
                                                            audioIndex,
                                                        ) => {
                                                            const url =
                                                                attachment.url;
                                                            const mimeType =
                                                                attachment.mimeType;
                                                            const audioKey = `${item.id}-audio-${audioIndex}`;
                                                            const isLoading =
                                                                audioLoadingKey ===
                                                                audioKey;
                                                            const isPlaying =
                                                                playingAudioKey ===
                                                                audioKey;
                                                            const isPressing =
                                                                activePressAudioKey ===
                                                                audioKey;
                                                            const isSeeking =
                                                                activeSeekAudioKey ===
                                                                audioKey;
                                                            const shouldAnimateIcon =
                                                                isLoading ||
                                                                isPlaying;
                                                            const progressInfo =
                                                                audioProgressMap[
                                                                    audioKey
                                                                ];
                                                            const positionMillis =
                                                                progressInfo?.positionMillis ??
                                                                0;
                                                            const durationMillis =
                                                                progressInfo?.durationMillis ??
                                                                0;
                                                            const progressRatio =
                                                                durationMillis >
                                                                0
                                                                    ? Math.min(
                                                                          1,
                                                                          Math.max(
                                                                              0,
                                                                              positionMillis /
                                                                                  durationMillis,
                                                                          ),
                                                                      )
                                                                    : 0;
                                                            const waveBars =
                                                                getAudioWaveBars(
                                                                    url,
                                                                );
                                                            const iconScaleNode =
                                                                isPlaying &&
                                                                isPressing
                                                                    ? combinedAudioIconScale
                                                                    : isPlaying
                                                                      ? audioPlayPulse
                                                                      : audioPressScale;

                                                            return (
                                                                <View
                                                                    key={
                                                                        audioKey
                                                                    }
                                                                    style={[
                                                                        styles.audioItem,
                                                                        mine &&
                                                                            styles.audioItemMine,
                                                                        !mine &&
                                                                            styles.cardShadow,
                                                                    ]}
                                                                >
                                                                    <Pressable
                                                                        style={[
                                                                            styles.audioPlayBtn,
                                                                            mine &&
                                                                                styles.audioPlayBtnMine,
                                                                        ]}
                                                                        delayLongPress={
                                                                            MESSAGE_LONG_PRESS_DELAY_MS
                                                                        }
                                                                        onLongPress={
                                                                            triggerMessageLongPress
                                                                        }
                                                                        onPress={() =>
                                                                            runTapAction(
                                                                                () => {
                                                                                    void toggleAudioPlayback(
                                                                                        audioKey,
                                                                                        url,
                                                                                        mimeType,
                                                                                    );
                                                                                },
                                                                            )
                                                                        }
                                                                        onPressIn={() =>
                                                                            handleAudioPressIn(
                                                                                audioKey,
                                                                            )
                                                                        }
                                                                        onPressOut={
                                                                            handleAudioPressOut
                                                                        }
                                                                        disabled={
                                                                            isLoading
                                                                        }
                                                                    >
                                                                        <Animated.View
                                                                            style={[
                                                                                styles.audioPlayIconWrap,
                                                                                (isPlaying ||
                                                                                    isPressing) && {
                                                                                    transform:
                                                                                        [
                                                                                            {
                                                                                                scale: iconScaleNode,
                                                                                            },
                                                                                        ],
                                                                                },
                                                                                shouldAnimateIcon && {
                                                                                    opacity:
                                                                                        audioIconFade,
                                                                                },
                                                                            ]}
                                                                        >
                                                                            <Ionicons
                                                                                name={
                                                                                    isLoading
                                                                                        ? "time-outline"
                                                                                        : isPlaying
                                                                                          ? "pause"
                                                                                          : "play"
                                                                                }
                                                                                size={
                                                                                    20
                                                                                }
                                                                                color={
                                                                                    colors.white
                                                                                }
                                                                            />
                                                                        </Animated.View>
                                                                    </Pressable>
                                                                    <View
                                                                        style={
                                                                            styles.audioMeta
                                                                        }
                                                                    >
                                                                        <Animated.View
                                                                            style={[
                                                                                styles.audioWaveformTrack,
                                                                                mine &&
                                                                                    styles.audioWaveformTrackMine,
                                                                                isSeeking && {
                                                                                    transform:
                                                                                        [
                                                                                            {
                                                                                                scaleY: audioSeekScale,
                                                                                            },
                                                                                        ],
                                                                                },
                                                                            ]}
                                                                            onLayout={(
                                                                                event,
                                                                            ) => {
                                                                                const width =
                                                                                    event
                                                                                        .nativeEvent
                                                                                        .layout
                                                                                        .width;
                                                                                setAudioTrackWidthMap(
                                                                                    (
                                                                                        prev: Record<
                                                                                            string,
                                                                                            number
                                                                                        >,
                                                                                    ) => {
                                                                                        if (
                                                                                            prev[
                                                                                                audioKey
                                                                                            ] ===
                                                                                            width
                                                                                        ) {
                                                                                            return prev;
                                                                                        }

                                                                                        return {
                                                                                            ...prev,
                                                                                            [audioKey]:
                                                                                                width,
                                                                                        };
                                                                                    },
                                                                                );
                                                                            }}
                                                                            onStartShouldSetResponder={() =>
                                                                                true
                                                                            }
                                                                            onMoveShouldSetResponder={() =>
                                                                                true
                                                                            }
                                                                            onResponderGrant={(
                                                                                event,
                                                                            ) => {
                                                                                const pageX =
                                                                                    event
                                                                                        .nativeEvent
                                                                                        .pageX;
                                                                                const pageY =
                                                                                    event
                                                                                        .nativeEvent
                                                                                        .pageY;
                                                                                audioWaveLongPressTriggeredRef.current = false;
                                                                                clearAudioWaveLongPressTimer();
                                                                                audioWaveLongPressTimerRef.current =
                                                                                    setTimeout(
                                                                                        () => {
                                                                                            audioWaveLongPressTriggeredRef.current = true;
                                                                                            triggerMessageLongPress(
                                                                                                {
                                                                                                    nativeEvent:
                                                                                                        {
                                                                                                            pageX,
                                                                                                            pageY,
                                                                                                        },
                                                                                                },
                                                                                            );
                                                                                        },
                                                                                        MESSAGE_LONG_PRESS_DELAY_MS,
                                                                                    );
                                                                                handleSeekInteractionStart(
                                                                                    audioKey,
                                                                                );
                                                                            }}
                                                                            onResponderMove={(
                                                                                event,
                                                                            ) => {
                                                                                if (
                                                                                    audioWaveLongPressTriggeredRef.current
                                                                                ) {
                                                                                    return;
                                                                                }
                                                                                clearAudioWaveLongPressTimer();
                                                                                seekAudioByLocation(
                                                                                    audioKey,
                                                                                    url,
                                                                                    event
                                                                                        .nativeEvent
                                                                                        .locationX,
                                                                                    true,
                                                                                );
                                                                            }}
                                                                            onResponderRelease={(
                                                                                event,
                                                                            ) => {
                                                                                clearAudioWaveLongPressTimer();
                                                                                if (
                                                                                    audioWaveLongPressTriggeredRef.current
                                                                                ) {
                                                                                    audioWaveLongPressTriggeredRef.current = false;
                                                                                    handleSeekInteractionEnd();
                                                                                    return;
                                                                                }
                                                                                seekAudioByLocation(
                                                                                    audioKey,
                                                                                    url,
                                                                                    event
                                                                                        .nativeEvent
                                                                                        .locationX,
                                                                                    false,
                                                                                );
                                                                                handleSeekInteractionEnd();
                                                                            }}
                                                                            onResponderTerminate={() => {
                                                                                clearAudioWaveLongPressTimer();
                                                                                audioWaveLongPressTriggeredRef.current = false;
                                                                                handleSeekInteractionEnd();
                                                                            }}
                                                                        >
                                                                            {waveBars.map(
                                                                                (
                                                                                    barHeight: number,
                                                                                    barIndex: number,
                                                                                ) => {
                                                                                    const barStart =
                                                                                        barIndex /
                                                                                        waveBars.length;
                                                                                    const barEnd =
                                                                                        (barIndex +
                                                                                            1) /
                                                                                        waveBars.length;
                                                                                    const fillRatio =
                                                                                        progressRatio <=
                                                                                        barStart
                                                                                            ? 0
                                                                                            : progressRatio >=
                                                                                                barEnd
                                                                                              ? 1
                                                                                              : (progressRatio -
                                                                                                    barStart) /
                                                                                                (barEnd -
                                                                                                    barStart);

                                                                                    return (
                                                                                        <View
                                                                                            key={`${audioKey}-bar-${barIndex}`}
                                                                                            style={[
                                                                                                styles.audioWaveBar,
                                                                                                {
                                                                                                    height: `${barHeight}%`,
                                                                                                },
                                                                                                mine
                                                                                                    ? styles.audioWaveBarIdleMine
                                                                                                    : styles.audioWaveBarIdleOther,
                                                                                            ]}
                                                                                        >
                                                                                            <View
                                                                                                style={[
                                                                                                    styles.audioWaveBarFill,
                                                                                                    mine
                                                                                                        ? styles.audioWaveBarPlayedMine
                                                                                                        : styles.audioWaveBarPlayedOther,
                                                                                                    {
                                                                                                        opacity:
                                                                                                            fillRatio,
                                                                                                    },
                                                                                                ]}
                                                                                            />
                                                                                        </View>
                                                                                    );
                                                                                },
                                                                            )}
                                                                        </Animated.View>
                                                                        <Text
                                                                            style={[
                                                                                styles.audioTimeText,
                                                                                mine &&
                                                                                    styles.audioTimeTextMine,
                                                                            ]}
                                                                        >
                                                                            {isSeeking &&
                                                                            durationMillis >
                                                                                0
                                                                                ? `${formatDurationMillis(positionMillis)} / ${formatDurationMillis(durationMillis)}`
                                                                                : formatDurationMillis(
                                                                                      positionMillis >
                                                                                          0
                                                                                          ? positionMillis
                                                                                          : durationMillis,
                                                                                  )}
                                                                        </Text>
                                                                    </View>
                                                                </View>
                                                            );
                                                        },
                                                    )}
                                                </View>
                                            ) : null}

                                            {fileAttachments.length > 0 ? (
                                                <View style={styles.fileList}>
                                                    {fileAttachments.map(
                                                        (
                                                            attachment,
                                                            fileIndex,
                                                        ) => (
                                                            <Pressable
                                                                key={`${item.id}-file-${fileIndex}`}
                                                                style={[
                                                                    styles.fileItem,
                                                                    mine &&
                                                                        styles.fileItemMine,
                                                                    !mine &&
                                                                        styles.cardShadow,
                                                                ]}
                                                                delayLongPress={
                                                                    MESSAGE_LONG_PRESS_DELAY_MS
                                                                }
                                                                onLongPress={
                                                                    triggerMessageLongPress
                                                                }
                                                                onPress={() =>
                                                                    runTapAction(
                                                                        () => {
                                                                            if (
                                                                                attachment.resolvedUrl
                                                                            ) {
                                                                                void Linking.openURL(
                                                                                    attachment.resolvedUrl,
                                                                                );
                                                                            }
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                <View
                                                                    style={
                                                                        styles.fileBadge
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.fileBadgeText
                                                                        }
                                                                    >
                                                                        {getFileBadgeLabel(
                                                                            attachment.fileName,
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.fileMeta
                                                                    }
                                                                >
                                                                    <Text
                                                                        numberOfLines={
                                                                            1
                                                                        }
                                                                        style={[
                                                                            styles.fileName,
                                                                            mine &&
                                                                                styles.fileNameMine,
                                                                        ]}
                                                                    >
                                                                        {attachment.fileName ||
                                                                            "Tep dinh kem"}
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.fileSize
                                                                        }
                                                                    >
                                                                        {formatFileSize(
                                                                            attachment.fileSize,
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.fileActionIconWrap
                                                                    }
                                                                >
                                                                    <Ionicons
                                                                        name="download-outline"
                                                                        size={18}
                                                                        color="#334155"
                                                                    />
                                                                </View>
                                                            </Pressable>
                                                        ),
                                                    )}
                                                </View>
                                            ) : null}

                                            {callMeta ? (
                                                <Pressable
                                                    style={[
                                                        styles.callCard,
                                                        mine &&
                                                            styles.callCardMine,
                                                        !mine &&
                                                            styles.cardShadow,
                                                    ]}
                                                    onPress={() =>
                                                        onRecallCall?.(
                                                            callMeta.callType,
                                                        )
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.callMainRow
                                                        }
                                                    >
                                                        <View
                                                            style={[
                                                                styles.callIconWrap,
                                                                mine &&
                                                                    styles.callIconWrapMine,
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name={
                                                                    callMeta.icon
                                                                }
                                                                size={18}
                                                                color={
                                                                    mine
                                                                        ? colors.white
                                                                        : callMeta.iconColor
                                                                }
                                                            />
                                                        </View>
                                                        <View
                                                            style={
                                                                styles.callMeta
                                                            }
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.callTitle,
                                                                    mine &&
                                                                        styles.callTitleMine,
                                                                ]}
                                                            >
                                                                {callMeta.title}
                                                            </Text>
                                                            <Text
                                                                style={[
                                                                    styles.callSubtitle,
                                                                    mine &&
                                                                        styles.callSubtitleMine,
                                                                ]}
                                                            >
                                                                {
                                                                    callMeta.subtitle
                                                                }
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View
                                                        style={[
                                                            styles.callRecallBadge,
                                                            mine &&
                                                                styles.callRecallBadgeMine,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.callRecallText,
                                                                mine &&
                                                                    styles.callRecallTextMine,
                                                            ]}
                                                        >
                                                            Goi lai
                                                        </Text>
                                                    </View>
                                                </Pressable>
                                            ) : null}

                                            {groupInviteToken ? (
                                                <Pressable
                                                    style={[
                                                        styles.inviteCard,
                                                        mine && styles.inviteCardMine,
                                                        !mine && styles.cardShadow,
                                                    ]}
                                                    delayLongPress={
                                                        MESSAGE_LONG_PRESS_DELAY_MS
                                                    }
                                                    onLongPress={
                                                        triggerMessageLongPress
                                                    }
                                                    onPress={() =>
                                                        runTapAction(() =>
                                                            router.push({
                                                                pathname:
                                                                    "/(stack)/group-invite/[token]" as any,
                                                                params: {
                                                                    token: groupInviteToken,
                                                                    returnConversationId:
                                                                        String(
                                                                            item.conversationId,
                                                                        ),
                                                                },
                                                            } as any),
                                                        )
                                                    }
                                                >
                                                    <View style={styles.inviteHero}>
                                                        <View style={styles.inviteCircleLarge} />
                                                        <View style={styles.inviteCircleSmall} />
                                                        <View style={styles.inviteAvatar}>
                                                            <Ionicons
                                                                name="people-outline"
                                                                size={28}
                                                                color="#8a94a6"
                                                            />
                                                        </View>
                                                        <View style={styles.inviteHeroText}>
                                                            <Text style={styles.inviteEyebrow}>
                                                                Nhóm
                                                            </Text>
                                                            <Text
                                                                numberOfLines={1}
                                                                style={styles.inviteTitle}
                                                            >
                                                                Link tham gia nhóm
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View style={styles.inviteMeta}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.inviteMetaTitle}>
                                                                Mời tham gia nhóm
                                                            </Text>
                                                            <Text style={styles.inviteMetaSub}>
                                                                Bấm để xem thông tin nhóm
                                                            </Text>
                                                        </View>
                                                        <Ionicons
                                                            name="open-outline"
                                                            size={18}
                                                            color="#94a3b8"
                                                        />
                                                    </View>
                                                </Pressable>
                                            ) : null}

                                            {item.type === "POLL" && localPoll ? (
                                                <>
                                                <Pressable
                                                    style={styles.pollCard}
                                                    onPress={() => setPollModalOpen(true)}
                                                >
                                                    {(() => {
                                                        const pollEnded =
                                                            localPoll.closed ||
                                                            localPoll.recalled ||
                                                            isPollExpired(localPoll);
                                                        const visibleOptions = localPoll.options.slice(0, 3);
                                                        const hiddenOptionCount = Math.max(
                                                            0,
                                                            localPoll.options.length - visibleOptions.length,
                                                        );
                                                        const selectedOptionIds =
                                                            localPoll.currentUserOptionIds ?? [];
                                                        const totalVoters =
                                                            localPoll.totalVoterCount ?? localPoll.totalVoteCount;
                                                        const endLabel = formatPollEndLabel(
                                                            localPoll.expiresAt || (pollEnded ? localPoll.updatedAt : null),
                                                            pollEnded,
                                                        );

                                                        return (
                                                            <>
                                                    <View style={styles.pollHeader}>
                                                        <View style={styles.pollHeaderText}>
                                                            <Text
                                                                numberOfLines={1}
                                                                style={styles.pollTitle}
                                                            >
                                                                {localPoll.title || item.content}
                                                            </Text>
                                                            {endLabel ? (
                                                                <Text style={styles.pollSubtitle}>
                                                                    {endLabel}
                                                                </Text>
                                                            ) : null}
                                                            <Text style={styles.pollSubtitle}>
                                                                {localPoll.allowMultipleChoices
                                                                    ? "Chọn nhiều phương án"
                                                                    : "Chọn một phương án"}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    {!pollEnded ? (
                                                        <Text style={styles.pollSummary}>
                                                            {totalVoters > 0
                                                                ? `${totalVoters} người đã bình chọn`
                                                                : "Chưa có ai bình chọn"}
                                                        </Text>
                                                    ) : null}

                                                    {visibleOptions.map((option) => {
                                                        const selected =
                                                            selectedOptionIds.includes(option.id) ||
                                                            option.selectedByCurrentUser;

                                                        return (
                                                            <View
                                                                key={option.id}
                                                                style={[
                                                                    styles.pollOption,
                                                                    selected && styles.pollOptionSelected,
                                                                ]}
                                                            >
                                                                <Text
                                                                    numberOfLines={1}
                                                                    style={styles.pollOptionText}
                                                                >
                                                                    {option.text}
                                                                </Text>
                                                                {renderPollAvatarStack(option.voterIds)}
                                                                <Text style={styles.pollOptionCount}>
                                                                    {option.voteCount}
                                                                </Text>
                                                            </View>
                                                        );
                                                    })}

                                                    {hiddenOptionCount > 0 ? (
                                                        <Text style={styles.pollMoreText}>
                                                            * Con {hiddenOptionCount} lua chon khac
                                                        </Text>
                                                    ) : null}

                                                    <View style={styles.pollPreviewButton}>
                                                        <Text style={styles.pollPreviewButtonText}>
                                                            {pollEnded
                                                                ? "Xem lựa chọn"
                                                                : selectedOptionIds.length > 0
                                                                  ? "Đổi bình chọn"
                                                                  : "Bình chọn"}
                                                        </Text>
                                                    </View>
                                                            </>
                                                        );
                                                    })()}
                                                </Pressable>
                                                <Modal
                                                    visible={pollModalOpen}
                                                    transparent
                                                    animationType="fade"
                                                    onRequestClose={() => {
                                                        setPollModalOpen(false);
                                                        setPollDetailOpen(false);
                                                        setPollSettingsOpen(false);
                                                    }}
                                                >
                                                    <View style={styles.pollModalOverlay}>
                                                        <View style={styles.pollModalCard}>
                                                            <View style={styles.pollModalHeader}>
                                                                {pollDetailOpen ? (
                                                                    <Pressable
                                                                        onPress={() => setPollDetailOpen(false)}
                                                                        hitSlop={8}
                                                                        style={styles.pollHeaderIconButton}
                                                                    >
                                                                        <Ionicons name="chevron-back" size={23} color="#111827" />
                                                                    </Pressable>
                                                                ) : null}
                                                                <Text style={styles.pollModalTitle}>
                                                                    {pollDetailOpen ? "Chi tiết bình chọn" : "Bình chọn"}
                                                                </Text>
                                                                <Pressable
                                                                    onPress={() => {
                                                                        setPollModalOpen(false);
                                                                        setPollDetailOpen(false);
                                                                        setPollSettingsOpen(false);
                                                                    }}
                                                                    hitSlop={8}
                                                                    style={styles.pollHeaderIconButton}
                                                                >
                                                                    <Ionicons name="close" size={22} color="#111827" />
                                                                </Pressable>
                                                            </View>
                                                            <ScrollView
                                                                style={styles.pollModalBody}
                                                                contentContainerStyle={styles.pollModalBodyContent}
                                                                keyboardShouldPersistTaps="handled"
                                                            >
                                                                {(() => {
                                                                    const pollEnded =
                                                                        localPoll.closed ||
                                                                        localPoll.recalled ||
                                                                        isPollExpired(localPoll);
                                                                    const endLabel = formatPollEndLabel(
                                                                        localPoll.expiresAt || (pollEnded ? localPoll.updatedAt : null),
                                                                        pollEnded,
                                                                    );
                                                                    const totalVoters =
                                                                        localPoll.totalVoterCount ?? localPoll.totalVoteCount;

                                                                    if (pollDetailOpen) {
                                                                        return (
                                                                            <>
                                                                                {localPoll.options.map((option) => {
                                                                                    const voters = (option.voterIds ?? []).map(Number);
                                                                                    if (voters.length === 0) return null;
                                                                                    return (
                                                                                        <View key={option.id} style={styles.pollDetailGroup}>
                                                                                            <Text style={styles.pollDetailOptionTitle}>
                                                                                                {option.text} ({voters.length})
                                                                                            </Text>
                                                                                            {voters.map((voterId) => {
                                                                                                const member = getPollMember(voterId);
                                                                                                return (
                                                                                                    <View
                                                                                                        key={`${option.id}-${voterId}`}
                                                                                                        style={styles.pollDetailVoterRow}
                                                                                                    >
                                                                                                        <UserAvatar
                                                                                                            uri={member?.avatar}
                                                                                                            name={getPollMemberName(voterId)}
                                                                                                            size={38}
                                                                                                        />
                                                                                                        <Text style={styles.pollDetailVoterName}>
                                                                                                            {getPollMemberName(voterId)}
                                                                                                        </Text>
                                                                                                    </View>
                                                                                                );
                                                                                            })}
                                                                                        </View>
                                                                                    );
                                                                                })}
                                                                            </>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <>
                                                                            <Text style={styles.pollModalQuestion}>
                                                                                {localPoll.title || item.content}
                                                                            </Text>
                                                                            <Text style={styles.pollCreatorText}>
                                                                                Tạo bởi {pollCreatorName}
                                                                                {pollCreatedDayLabel ? ` · ${pollCreatedDayLabel}` : ""}
                                                                            </Text>
                                                                            {endLabel ? (
                                                                                <View style={styles.pollMetaRow}>
                                                                                    <Ionicons name="time-outline" size={16} color="#4B5563" />
                                                                                    <Text style={styles.pollModalMeta}>{endLabel}</Text>
                                                                                </View>
                                                                            ) : null}
                                                                            <View style={styles.pollMetaRow}>
                                                                                <Ionicons name="list-outline" size={16} color="#4B5563" />
                                                                                <Text style={styles.pollModalMeta}>
                                                                                    {localPoll.allowMultipleChoices
                                                                                        ? "Chọn nhiều phương án"
                                                                                        : "Chọn một phương án"}
                                                                                </Text>
                                                                            </View>
                                                                            {localPoll.anonymous ? (
                                                                                <View style={styles.pollMetaRow}>
                                                                                    <Ionicons name="eye-off-outline" size={16} color="#4B5563" />
                                                                                    <Text style={styles.pollModalMeta}>
                                                                                        Ẩn người bình chọn
                                                                                    </Text>
                                                                                </View>
                                                                            ) : null}
                                                                            {localPoll.anonymous ? (
                                                                                <View style={styles.pollAnonymousBlock}>
                                                                                    <Text style={styles.pollAnonymousNotice}>
                                                                                        {totalVoters} người bình chọn, {localPoll.totalVoteCount} lượt chọn
                                                                                    </Text>
                                                                                </View>
                                                                            ) : (
                                                                                <Pressable
                                                                                    style={styles.pollSummaryLink}
                                                                                    onPress={() => setPollDetailOpen(true)}
                                                                                >
                                                                                    <Text style={styles.pollSummaryLinkText}>
                                                                                        {totalVoters} người bình chọn, {localPoll.totalVoteCount} lượt chọn
                                                                                    </Text>
                                                                                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                                                                                </Pressable>
                                                                            )}
                                                                            {localPoll.options.map((option) => {
                                                                                const selected =
                                                                                    pollDraftOptionIds.includes(option.id);
                                                                                const percent =
                                                                                    localPoll.totalVoteCount > 0
                                                                                        ? Math.round((option.voteCount / localPoll.totalVoteCount) * 100)
                                                                                        : 0;
                                                                                return (
                                                                                    <Pressable
                                                                                        key={option.id}
                                                                                        disabled={pollUpdating || pollEnded}
                                                                                        onPress={() => togglePollDraftOption(option.id)}
                                                                                        style={[
                                                                                            styles.pollOption,
                                                                                            selected && styles.pollOptionSelected,
                                                                                        ]}
                                                                                    >
                                                                                        <Text numberOfLines={1} style={styles.pollOptionText}>
                                                                                            {option.text}
                                                                                        </Text>
                                                                                        {renderPollAvatarStack(option.voterIds)}
                                                                                        <Text style={styles.pollOptionCount}>
                                                                                            {option.voteCount} · {percent}%
                                                                                        </Text>
                                                                                    </Pressable>
                                                                                );
                                                                            })}
                                                                            {localPoll.allowAddOption && !pollEnded ? (
                                                                                <View style={styles.pollAddRow}>
                                                                                    <TextInput
                                                                                        value={pollOptionDraft}
                                                                                        onChangeText={setPollOptionDraft}
                                                                                        placeholder="Thêm lựa chọn"
                                                                                        placeholderTextColor="#9CA3AF"
                                                                                        style={styles.pollAddInput}
                                                                                    />
                                                                                    <Pressable
                                                                                        disabled={pollAddingOption || pollOptionDraft.trim().length === 0}
                                                                                        onPress={() => void handleAddPollOption()}
                                                                                        style={[
                                                                                            styles.pollAddButton,
                                                                                            (pollAddingOption || pollOptionDraft.trim().length === 0) &&
                                                                                                styles.pollAddButtonDisabled,
                                                                                        ]}
                                                                                    >
                                                                                        <Ionicons name="add" size={18} color="#fff" />
                                                                                    </Pressable>
                                                                                </View>
                                                                            ) : null}
                                                                            {pollEnded ? (
                                                                                <View style={styles.pollClosedNotice}>
                                                                                    <Ionicons name="lock-closed-outline" size={15} color="#6B7280" />
                                                                                    <Text style={styles.pollClosedNoticeText}>
                                                                                        Bình chọn đã đóng
                                                                                    </Text>
                                                                                </View>
                                                                            ) : null}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </ScrollView>
                                                            <View style={styles.pollModalFooter}>
                                                                {!pollDetailOpen ? (
                                                                    <View style={styles.pollSettingsWrap}>
                                                                        <Pressable
                                                                            style={styles.pollSettingsButton}
                                                                            onPress={() => setPollSettingsOpen((open) => !open)}
                                                                        >
                                                                            <Ionicons name="settings-outline" size={22} color="#0F172A" />
                                                                        </Pressable>
                                                                        {pollSettingsOpen ? (
                                                                            <View style={styles.pollSettingsMenu}>
                                                                                <Pressable
                                                                                    style={styles.pollSettingsMenuItem}
                                                                                    onPress={() => void handlePinPoll()}
                                                                                >
                                                                                    <Text style={styles.pollSettingsMenuText}>
                                                                                        {isPinned ? "Bỏ ghim" : "Ghim lên đầu trò chuyện"}
                                                                                    </Text>
                                                                                </Pressable>
                                                                                {canManageCurrentPoll &&
                                                                                !localPoll.closed &&
                                                                                !localPoll.recalled &&
                                                                                !isPollExpired(localPoll) ? (
                                                                                    <Pressable
                                                                                        style={styles.pollSettingsMenuItem}
                                                                                        onPress={handleClosePoll}
                                                                                    >
                                                                                        <Text style={styles.pollSettingsMenuText}>Khóa bình chọn</Text>
                                                                                    </Pressable>
                                                                                ) : null}
                                                                            </View>
                                                                        ) : null}
                                                                    </View>
                                                                ) : (
                                                                    <View style={styles.pollSettingsWrap} />
                                                                )}
                                                                {!pollDetailOpen &&
                                                                !localPoll.closed &&
                                                                !localPoll.recalled &&
                                                                !isPollExpired(localPoll) ? (
                                                                    <Pressable
                                                                        disabled={pollUpdating}
                                                                        onPress={() => void submitPollDraft()}
                                                                        style={styles.pollConfirmButton}
                                                                    >
                                                                        <Text style={styles.pollConfirmButtonText}>
                                                                            {pollUpdating ? "Đang xác nhận..." : "Xác nhận"}
                                                                        </Text>
                                                                    </Pressable>
                                                                ) : (
                                                                    <Pressable
                                                                        onPress={() => {
                                                                            setPollModalOpen(false);
                                                                            setPollDetailOpen(false);
                                                                            setPollSettingsOpen(false);
                                                                        }}
                                                                        style={styles.pollModalCloseButton}
                                                                    >
                                                                        <Text style={styles.pollModalCloseButtonText}>Đóng</Text>
                                                                    </Pressable>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                </Modal>
                                                </>
                                            ) : null}

                                            {shouldShowFallbackText ? (
                                                <Text
                                                    style={[
                                                        styles.messageText,
                                                        mine &&
                                                            styles.messageTextMine,
                                                    ]}
                                                >
                                                    {item.content
                                                        ? renderTextWithLinks(
                                                              visibleTextContent ?? "",
                                                              mine,
                                                          )
                                                        : "Tin nhan khong co noi dung"}
                                                    {shouldCollapseText ? (
                                                        <Text
                                                            style={[
                                                                styles.expandTextButton,
                                                                mine &&
                                                                    styles.expandTextButtonMine,
                                                            ]}
                                                            onPress={() =>
                                                                setTextExpanded(
                                                                    (value) => !value,
                                                                )
                                                            }
                                                        >
                                                            {textExpanded
                                                                ? " Thu gon"
                                                                : " Xem them"}
                                                        </Text>
                                                    ) : null}
                                                </Text>
                                            ) : null}

                                            {shouldShowAttachmentCaption ? (
                                                <View
                                                    style={[
                                                        styles.attachmentCaptionBubble,
                                                        mine &&
                                                            styles.attachmentCaptionBubbleMine,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.attachmentCaptionText,
                                                            mine &&
                                                                styles.attachmentCaptionTextMine,
                                                        ]}
                                                    >
                                                        {item.content}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                </>
                            )}
                        </Pressable>
                            </View>
                        </View>
                    </Animated.View>
                </PanGestureHandler>

                {item.iconName && item.iconName.length > 0 ? (
                    <View
                        style={[
                            styles.messageMetaRow,
                            mine
                                ? styles.messageMetaRowMine
                                : styles.messageMetaRowOther,
                            { marginTop: 4, zIndex: 10 }
                        ]}
                    >
                        <Pressable 
                            style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
                            onPress={() => setReactionDetailVisible(true)}
                        >
                            {item.iconName.slice(0, 3).map((reaction, i) => (
                                <Text key={i} style={{ fontSize: 13, marginRight: i === Math.min(item.iconName!.length, 3) - 1 ? 0 : -2 }}>
                                    {reaction.name}
                                </Text>
                            ))}
                            {item.iconName.reduce((sum, r) => sum + r.user.reduce((acc, u) => acc + u.quantity, 0), 0) > 1 && (
                                <Text style={{ fontSize: 11, fontWeight: "600", color: "#6B7280", marginLeft: 4 }}>
                                    {item.iconName.reduce((sum, r) => sum + r.user.reduce((acc, u) => acc + u.quantity, 0), 0)}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                ) : null}

                {isLastInGroup && !mine && messageTime ? (
                    <View
                        style={[
                            styles.messageMetaRow,
                            mine
                                ? styles.messageMetaRowMine
                                : styles.messageMetaRowOther,
                        ]}
                    >
                        <View style={styles.deliveryMetaPill}>
                            <Text style={styles.deliveryMetaPillText}>
                                {messageTime}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {mine && isLastInGroup ? (
                    <View
                        style={[
                            styles.messageMetaRow,
                            styles.messageMetaRowMine,
                        ]}
                    >
                        <View style={styles.deliveryMetaPillRow}>
                            {messageTime ? (
                                <View style={styles.deliveryMetaPill}>
                                    <Text style={styles.deliveryMetaPillText}>
                                        {messageTime}
                                    </Text>
                                </View>
                            ) : null}
                            {receiptsForThisMessage.length > 0 ? (
                                <View style={styles.deliverySeenAvatarRow}>
                                    {receiptsForThisMessage.map((receipt) => {
                                        const member = membersById[receipt.userId];
                                        const receiptLocked = isUserAccountLocked(receipt.userId);
                                        return (
                                            <View
                                                key={`${item.id}-${receipt.userId}`}
                                                style={styles.deliverySeenAvatar}
                                            >
                                                <UserAvatar
                                                    uri={receiptLocked ? undefined : member?.avatar}
                                                    name={
                                                        receiptLocked
                                                            ? LOCKED_ACCOUNT_NAME
                                                            : member?.nickname ||
                                                              member?.username ||
                                                              "?"
                                                    }
                                                    size={20}
                                                    locked={receiptLocked}
                                                />
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View
                                    style={[
                                        styles.deliveryMetaPill,
                                        (item.deliveryStatus ?? "sent") === "failed" &&
                                            styles.deliveryMetaPillFailed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.deliveryMetaPillText,
                                            (item.deliveryStatus ?? "sent") ===
                                                "failed" &&
                                                styles.deliveryMetaPillTextFailed,
                                        ]}
                                    >
                                        {(item.deliveryStatus ?? "sent") === "sending"
                                            ? "Dang gui"
                                            : (item.deliveryStatus ?? "sent") === "failed"
                                              ? "Chua gui"
                                              : "Da gui"}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                ) : null}

                <ReactionDetailModal
                    visible={reactionDetailVisible}
                    onClose={() => setReactionDetailVisible(false)}
                    reactions={item.iconName || []}
                    membersById={membersById}
                />
            </View>
        );
    },
);

MessageBubble.displayName = "MessageBubble";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",
    },
    flex: { flex: 1 },
    header: {
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
    },
    headerBackBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.xs,
    },
    headerIdentity: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0,
    },
    headerMeta: {
        marginLeft: spacing.sm,
        minWidth: 0,
    },
    headerName: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.text,
    },
    headerStatus: {
        marginTop: 2,
        fontSize: 13,
        color: colors.textMuted,
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: spacing.xs,
    },
    headerActionBtn: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: spacing.xs,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: 0,
    },
    messageItemWrap: {
        width: "100%",
        position: "relative",
    },
    swipeReplyRow: {
        width: "100%",
        zIndex: 1,
    },
    swipeReplyCue: {
        position: "absolute",
        top: 18,
        height: 34,
        width: 34,
        borderRadius: 17,
        backgroundColor: "#EAF2FF",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 0,
    },
    swipeReplyCueOther: {
        left: 42,
    },
    swipeReplyCueMine: {
        right: 8,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    rowGroupStart: {
        marginTop: 9,
    },
    rowGrouped: {
        marginTop: 2,
    },
    rowGroupedRecalled: {
        marginTop: 8,
    },
    rowGroupedWithReply: {
        marginTop: 8,
    },
    rowMine: {
        justifyContent: "flex-end",
    },
    rowOther: {
        justifyContent: "flex-start",
    },
    rowPollCenter: {
        justifyContent: "center",
    },
    avatarSpacer: {
        width: 30,
    },
    messageColumn: {
        maxWidth: "80%",
    },
    messageColumnMine: {
        alignItems: "flex-end",
    },
    messageColumnOther: {
        alignItems: "flex-start",
        marginLeft: spacing.sm,
    },
    messageColumnPoll: {
        alignItems: "center",
        marginLeft: 0,
        maxWidth: "100%",
    },
    groupSenderLabel: {
        maxWidth: 180,
        marginBottom: 4,
        marginLeft: 2,
        fontSize: 11,
        fontWeight: "700",
        color: "#6B7280",
    },
    replyRelationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        maxWidth: "92%",
        marginTop: 2,
        marginBottom: 2,
        marginLeft: 2,
    },
    replyRelationRowMine: {
        alignSelf: "flex-start",
    },
    replyRelationLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#6B7280",
        flexShrink: 1,
        minWidth: 0,
    },
    replyRelationLabelMine: {
        color: "#6B7280",
    },
    bubble: {
        borderRadius: 18,
        paddingHorizontal: 13,
        paddingVertical: 9,
        maxWidth: "100%",
        marginBottom: 5,
    },
    bubbleAlignMine: {
        alignSelf: "flex-end",
    },
    bubbleAlignOther: {
        alignSelf: "flex-start",
    },
    bubbleWithReply: {
        marginTop: -4,
        position: "relative",
        zIndex: 3,
    },
    bubbleWithReplyMine: {
        borderTopRightRadius: 12,
    },
    bubbleWithReplyOther: {
        borderTopLeftRadius: 12,
    },
    bubblePlain: {
        borderRadius: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: "transparent",
    },
    highlightedBubble: {
        borderWidth: 2,
        borderColor: "#F59E0B",
    },
    bubbleMine: {
        backgroundColor: "#1D4ED8",
    },
    bubbleMineSingle: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
    },
    bubbleMineFirst: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
    },
    bubbleMineMiddle: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 8,
    },
    bubbleMineLast: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
    },
    bubbleOther: {
        backgroundColor: "#FFFFFF",

        borderColor: "#E5E7EB",
    },
    bubbleOtherSingle: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
    },
    bubbleOtherFirst: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
    },
    bubbleOtherMiddle: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 18,
    },
    bubbleOtherLast: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
    },
    bubbleRecalled: {
        backgroundColor: "#F3F4F6",
    },
    cardShadow: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 1,
    },
    messageText: {
        color: colors.text,
        fontSize: 15,
        lineHeight: 21,
    },
    messageTextMine: {
        color: colors.white,
    },
    expandTextButton: {
        color: colors.primary,
        fontWeight: "800",
    },
    expandTextButtonMine: {
        color: colors.white,
    },
    pollCard: {
        width: 280,
        maxWidth: 300,
        padding: spacing.md,
        backgroundColor: colors.white,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#D1D5DB",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2,
    },
    pollHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    pollHeaderText: {
        flex: 1,
    },
    pollTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
    },
    pollSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: "#6B7280",
    },
    pollSummary: {
        marginBottom: spacing.xs,
        fontSize: 12,
        fontWeight: "700",
        color: colors.primary,
    },
    pollOption: {
        marginTop: spacing.xs,
        borderRadius: 8,
        backgroundColor: "#F3F4F6",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#E5E7EB",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    pollOptionSelected: {
        backgroundColor: "#EFF6FF",
        borderColor: "#3B82F6",
    },
    pollOptionText: {
        flex: 1,
        fontSize: 13,
        color: "#111827",
    },
    pollOptionCount: {
        fontSize: 12,
        color: "#6B7280",
    },
    pollAvatarStack: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 4,
    },
    pollAvatarWrap: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#fff",
        backgroundColor: "#fff",
    },
    pollAvatarOverlap: {
        marginLeft: -7,
    },
    pollAvatarMore: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: "#fff",
        backgroundColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
    },
    pollAvatarMoreText: {
        color: "#4B5563",
        fontSize: 10,
        fontWeight: "800",
    },
    pollMoreText: {
        marginTop: spacing.xs,
        fontSize: 12,
        color: "#6B7280",
    },
    pollAddRow: {
        marginTop: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    pollAddInput: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#D1D5DB",
        paddingHorizontal: spacing.sm,
        color: "#111827",
        backgroundColor: "#fff",
    },
    pollAddButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    pollAddButtonDisabled: {
        opacity: 0.45,
    },
    pollFooter: {
        marginTop: spacing.sm,
        fontSize: 12,
        color: "#6B7280",
    },
    pollPreviewButton: {
        marginTop: spacing.sm,
        height: 36,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    pollPreviewButtonText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: "800",
    },
    pollModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        paddingHorizontal: 18,
    },
    pollModalCard: {
        maxHeight: "86%",
        borderRadius: 8,
        backgroundColor: "#fff",
        overflow: "hidden",
    },
    pollModalHeader: {
        minHeight: 54,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    pollHeaderIconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },
    pollModalTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#111827",
    },
    pollModalBody: {
        maxHeight: 430,
    },
    pollModalBodyContent: {
        padding: 16,
    },
    pollModalQuestion: {
        fontSize: 17,
        fontWeight: "800",
        color: "#111827",
        marginBottom: 8,
    },
    pollCreatorText: {
        marginBottom: 14,
        color: "#6B7280",
        fontSize: 12,
        fontWeight: "600",
    },
    pollMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginBottom: 8,
    },
    pollModalMeta: {
        flexShrink: 1,
        fontSize: 13,
        color: "#4B5563",
    },
    pollAnonymousBlock: {
        marginBottom: 12,
    },
    pollAnonymousNotice: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    pollAnonymousSubText: {
        marginTop: 4,
        color: "#4B5563",
        fontSize: 13,
        fontWeight: "600",
    },
    pollSummaryLink: {
        alignSelf: "flex-start",
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    pollSummaryLinkText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    pollDetailGroup: {
        marginBottom: 22,
    },
    pollDetailOptionTitle: {
        marginBottom: 12,
        color: "#111827",
        fontSize: 14,
        fontWeight: "800",
    },
    pollDetailVoterRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
    },
    pollDetailVoterName: {
        color: "#1F2937",
        fontSize: 14,
        fontWeight: "600",
    },
    pollClosedNotice: {
        marginTop: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    pollClosedNoticeText: {
        color: "#6B7280",
        fontSize: 13,
        fontWeight: "600",
    },
    pollModalFooter: {
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
    },
    pollSettingsWrap: {
        marginRight: "auto",
        position: "relative",
        minWidth: 40,
    },
    pollSettingsButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    pollSettingsMenu: {
        position: "absolute",
        left: 0,
        bottom: 46,
        width: 220,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#fff",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
        elevation: 6,
        overflow: "hidden",
        zIndex: 10,
    },
    pollSettingsMenuItem: {
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E7EB",
    },
    pollSettingsMenuText: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "600",
    },
    pollCloseButton: {
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEE2E2",
    },
    pollCloseButtonText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#DC2626",
    },
    pollModalCloseButton: {
        height: 38,
        paddingHorizontal: 18,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E5E7EB",
    },
    pollModalCloseButtonText: {
        color: "#111827",
        fontWeight: "800",
    },
    pollConfirmButton: {
        height: 38,
        paddingHorizontal: 18,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    pollConfirmButtonText: {
        color: "#fff",
        fontWeight: "800",
    },
    inlineLink: {
        color: colors.primary,
        textDecorationLine: "underline",
        fontWeight: "700",
    },
    inlineLinkMine: {
        color: colors.white,
    },
    inviteCard: {
        width: 286,
        maxWidth: "100%",
        overflow: "hidden",
        borderRadius: 18,
        backgroundColor: "#EFF6FF",
    },
    inviteCardMine: {
        backgroundColor: "#EFF6FF",
        borderColor: "#93C5FD",
    },
    inviteHero: {
        margin: 10,
        height: 104,
        borderRadius: 14,
        backgroundColor: "#1D63FF",
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    inviteCircleLarge: {
        position: "absolute",
        left: -42,
        top: -20,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    inviteCircleSmall: {
        position: "absolute",
        left: 44,
        top: -34,
        width: 176,
        height: 176,
        borderRadius: 88,
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    inviteAvatar: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "#F8FAFC",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.75)",
    },
    inviteHeroText: {
        marginLeft: 14,
        flex: 1,
    },
    inviteEyebrow: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 13,
        fontWeight: "700",
    },
    inviteTitle: {
        marginTop: 5,
        color: "#fff",
        fontSize: 18,
        fontWeight: "900",
    },
    inviteMeta: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    inviteMetaTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "800",
    },
    inviteMetaSub: {
        marginTop: 2,
        color: colors.textMuted,
        fontSize: 12,
    },
    recalledText: {
        fontStyle: "italic",
        color: "#6B7280",
    },
    emojiOnlyText: {
        fontSize: 36,
        lineHeight: 42,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    replyPreview: {
        alignSelf: "flex-start",
        maxWidth: "100%",
        borderRadius: 13,
        backgroundColor: "rgba(243, 244, 246, 0.92)",
        borderColor: "rgba(203, 213, 225, 0.75)",
        borderLeftColor: "rgba(203, 213, 225, 0.75)",
        paddingHorizontal: 12,
        paddingTop: 8,
        marginBottom: 1,
    },
    replyPreviewOverlay: {
        paddingBottom: 6,
        marginBottom: -4,
        zIndex: 1,
    },
    replyPreviewMine: {
        alignSelf: "flex-end",
        backgroundColor: "rgba(243, 244, 246, 0.95)",
        borderColor: "rgba(203, 213, 225, 0.78)",
        borderLeftColor: "rgba(203, 213, 225, 0.78)",
    },
    replyPreviewConnectedMine: {
        borderBottomRightRadius: 10,
    },
    replyPreviewConnectedOther: {
        borderBottomLeftRadius: 10,
    },
    replyPreviewFullWrap: {
        alignSelf: "flex-start",
        maxWidth: "92%",
        borderRadius: 13,
        marginBottom: 1,
        overflow: "hidden",
        backgroundColor: "rgba(0, 0, 0, 0.05)",
    },
    replyPreviewFullWrapMine: {
        alignSelf: "flex-end",
    },
    replyPreviewFullBody: {
        width: 160,
        height: 100,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#D1D5DB",
    },
    replyPreviewFullImage: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        opacity: 0.8,
    },
    replyPreviewFullVideoOverlay: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
    },
    replyPreviewBody: {
        flexDirection: "row",
        alignItems: "center",
    },
    replyPreviewThumb: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginBottom: 10,
    },
    replyPreviewIconBox: {
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        marginLeft: -5,
    },
    replyPreviewIconBoxMine: {},
    replyPreviewTextWrap: {
        marginLeft: 5,
        flexShrink: 1,
        minWidth: 0,
    },
    replyPreviewTextWrapNoLead: {
        marginLeft: 0,
    },
    replyFileInline: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    replyContentOnly: {
        color: "#4B5563",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    replyContentOnlyMine: {
        color: "#4B5563",
    },
    bubbleMainContent: {
        zIndex: 0,
    },
    bubbleMainContentLifted: {
        marginTop: 0,
    },
    imageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 7,
        marginTop: 0,
        marginBottom: 4,
    },
    imageAttachment: {
        width: 138,
        height: 138,
        borderRadius: 16,
        backgroundColor: "#D1D5DB",
        borderWidth: 1,
    },
    imageAttachmentLarge: {
        width: 248,
        height: 286,
    },
    imageMoreOverlay: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.48)",
    },
    imageMoreText: {
        color: colors.white,
        fontSize: 22,
        fontWeight: "800",
    },
    mediaCardMine: {
        borderColor: "rgba(255,255,255,0.35)",
    },
    mediaCardOther: {
        borderColor: "#E5E7EB",
    },
    videoList: {
        marginBottom: 4,
    },
    videoWrap: {
        marginTop: 6,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
    },
    videoAttachment: {
        width: 248,
        height: 176,
        backgroundColor: "#111827",
    },
    videoExpandBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.7)",
    },
    audioList: {
        marginBottom: 4,
    },
    audioItem: {
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E5E7EB",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        paddingHorizontal: 10,
        paddingVertical: 9,
        minWidth: 220,
    },
    audioItemMine: {
        backgroundColor: "#3B82F6",
        borderColor: "rgba(255,255,255,0.28)",
    },
    audioPlayBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#111827",
    },
    audioPlayBtnMine: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    audioPlayIconWrap: {
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    audioMeta: {
        marginLeft: 8,
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
    },
    audioWaveformTrack: {
        flex: 1,
        height: 32,
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        overflow: "hidden",
    },
    audioWaveformTrackMine: {
        opacity: 1,
    },
    audioWaveBar: {
        flex: 1,
        borderRadius: 999,
        minHeight: 4,
        overflow: "hidden",
    },
    audioWaveBarFill: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    audioWaveBarPlayedMine: {
        backgroundColor: colors.white,
    },
    audioWaveBarPlayedOther: {
        backgroundColor: "#111827",
    },
    audioWaveBarIdleMine: {
        backgroundColor: "rgba(255, 255, 255, 0.35)",
    },
    audioWaveBarIdleOther: {
        backgroundColor: "#D1D5DB",
    },
    audioTimeText: {
        marginLeft: 8,
        color: "#374151",
        fontSize: 11,
        fontWeight: "600",
        fontVariant: ["tabular-nums"],
    },
    audioTimeTextMine: {
        color: "#E0E7FF",
    },
    fileList: {
        marginBottom: 4,
    },
    fileItem: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        width: 286,
        maxWidth: "100%",
    },
    fileItemMine: {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
    },
    fileBadge: {
        width: 50,
        height: 50,
        borderRadius: 9,
        backgroundColor: "#FEE2E2",
        alignItems: "center",
        justifyContent: "center",
    },
    fileBadgeText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#EF4444",
    },
    fileMeta: {
        marginLeft: 12,
        flex: 1,
        minWidth: 0,
    },
    fileName: {
        color: "#0F172A",
        fontSize: 14,
        fontWeight: "800",
    },
    fileNameMine: {
        color: "#0F172A",
    },
    fileSize: {
        marginTop: 4,
        color: "#64748B",
        fontSize: 12,
        fontWeight: "500",
    },
    fileSizeMine: {
        color: "#64748B",
    },
    fileActionIconWrap: {
        marginLeft: 10,
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },
    fileActionIconWrapMine: {
        backgroundColor: "#FFFFFF",
        borderColor: "#E2E8F0",
    },
    callCard: {
        marginTop: 6,
        borderRadius: 14,
        backgroundColor: "transparent",
        paddingHorizontal: 0,
        paddingVertical: 0,
        borderWidth: 0,
    },
    callCardMine: {},
    callMainRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    callIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.85)",
    },
    callIconWrapMine: {
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    callMeta: {
        marginLeft: 8,
        flexShrink: 1,
        minWidth: 0,
    },
    callTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111827",
    },
    callTitleMine: {
        color: colors.white,
    },
    callSubtitle: {
        marginTop: 1,
        fontSize: 11,
        color: "#6B7280",
    },
    callSubtitleMine: {
        color: "#DBEAFE",
    },
    callRecallBadge: {
        alignSelf: "flex-start",
        marginTop: 8,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    callRecallBadgeMine: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    callRecallText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#1F2937",
    },
    callRecallTextMine: {
        color: colors.white,
    },
    attachmentCaptionBubble: {
        marginTop: 7,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    attachmentCaptionBubbleMine: {
        backgroundColor: "#1D4ED8",
        borderColor: "rgba(255,255,255,0.28)",
    },
    attachmentCaptionText: {
        fontSize: 14,
        lineHeight: 20,
        color: colors.text,
    },
    attachmentCaptionTextMine: {
        color: colors.white,
    },
    messageTime: {
        marginTop: 3,
        fontSize: 11,
        color: "#6B7280",
    },
    messageTimeMine: {
        color: "#6B7280",
        marginRight: 2,
    },
    messageMetaRow: {
        width: "100%",
        marginTop: 1,
    },
    messageMetaRowMine: {
        alignItems: "flex-end",
        paddingRight: 2,
    },
    messageMetaRowOther: {
        alignItems: "flex-start",
        paddingLeft: 30 + spacing.sm,
    },
    systemMessageRow: {
        width: "100%",
        alignItems: "center",
        marginTop: 14,
    },
    systemMessageBadge: {
        maxWidth: "94%",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#F8FAFC",
        flexDirection: "row",
        alignItems: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#E5E7EB",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.11,
        shadowRadius: 5,
        elevation: 2,
    },
    systemPollBadge: {
        maxWidth: "94%",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#F8FAFC",
        flexDirection: "row",
        alignItems: "flex-start",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#E5E7EB",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.11,
        shadowRadius: 5,
        elevation: 2,
    },
    systemMessageText: {
        marginLeft: 6,
        fontSize: 12,
        color: "#374151",
        fontWeight: "600",
        flexShrink: 1,
    },
    systemPollLink: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.primary,
    },
    systemCollapsedBtn: {
        maxWidth: "94%",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#F8FAFC",
        flexDirection: "row",
        alignItems: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#E5E7EB",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.11,
        shadowRadius: 5,
        elevation: 2,
    },
    systemCollapsedBtnText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: "700",
        color: "#374151",
    },
    seenReceiptsRow: {
        marginTop: 4,
        marginRight: 2,
        alignSelf: "flex-end",
        flexDirection: "row",
        gap: 4,
    },
    deliveryMetaPillRow: {
        marginTop: 4,
        marginRight: 2,
        alignSelf: "flex-end",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    deliveryMetaPill: {
        minHeight: 20,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: "#B8BDC5",
        alignItems: "center",
        justifyContent: "center",
    },
    deliveryMetaPillFailed: {
        backgroundColor: "#FEE2E2",
    },
    deliveryMetaPillText: {
        color: colors.white,
        fontSize: 11,
        lineHeight: 12,
        fontWeight: "700",
        includeFontPadding: false,
    },
    deliveryMetaPillTextFailed: {
        color: "#DC2626",
    },
    deliverySeenAvatarRow: {
        minHeight: 20,
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: -1,
    },
    deliverySeenAvatar: {
        marginHorizontal: -1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.white,
        overflow: "hidden",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
        elevation: 1,
    },
    loadingOlderText: {
        alignSelf: "center",
        marginBottom: spacing.sm,
        fontSize: 12,
        color: colors.textMuted,
    },
    loadingNewerText: {
        alignSelf: "center",
        marginTop: spacing.sm,
        fontSize: 12,
        color: colors.textMuted,
    },
    scrollToBottomFab: {
        position: "absolute",
        right: spacing.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 20,
    },
    scrollToBottomBadge: {
        position: "absolute",
        top: -4,
        left: -4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
    },
    scrollToBottomBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.white,
    },
    rightScrollCue: {
        position: "absolute",
        right: 4,
        width: 4,
        height: RIGHT_SCROLL_CUE_HEIGHT,
        borderRadius: 999,
        backgroundColor: "rgba(75, 85, 99, 0.55)",
        zIndex: 18,
    },
    composerWrap: {
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
    },
    replyComposerBox: {
        borderLeftWidth: 3,
        borderLeftColor: "#3B82F6",
        backgroundColor: "#EFF6FF",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    replyComposerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    replyComposerSender: {
        color: "#1D4ED8",
        fontSize: 12,
        fontWeight: "700",
    },
    replyComposerContent: {
        marginTop: 2,
        color: "#374151",
        fontSize: 12,
    },
    composerBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0F1F3",
        borderRadius: 26,
        minHeight: 48,
        paddingLeft: 6,
        paddingRight: spacing.sm,
    },
    cameraBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#5B5CF0",
        alignItems: "center",
        justifyContent: "center",
    },
    composerActions: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: spacing.xs,
    },
    composerActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 2,
    },
    sendArrowBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 4,
        backgroundColor: "transparent",
    },
    emojiPickerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.2)",
        justifyContent: "flex-end",
        paddingHorizontal: spacing.md,
        paddingBottom: 76,
    },
    emojiPickerCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    emojiPickerHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    emojiPickerTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.text,
    },
    emojiGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    emojiCell: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    emojiCellText: {
        fontSize: 20,
    },
    recordingComposerRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    recordingSideBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    recordingPill: {
        flex: 1,
        marginHorizontal: 6,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1D4ED8",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    recordingWaveTrack: {
        flex: 1,
        marginLeft: 10,
        marginRight: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    recordingWaveBar: {
        width: 3,
        borderRadius: 999,
        backgroundColor: "#BFDBFE",
    },
    recordingPillTime: {
        color: colors.white,
        fontSize: 12,
        fontWeight: "700",
        minWidth: 34,
        textAlign: "right",
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        paddingHorizontal: spacing.sm,
        paddingVertical: Platform.OS === "ios" ? 11 : 9,
        gap: spacing.sm,
    },
    statusText: {
        marginTop: spacing.xs,
        fontSize: 12,
        color: colors.textMuted,
    },
    typingIndicatorRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: spacing.md,
    },
    typingAvatarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 8,
    },
    typingBubble: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: "#E5E7EB",
        alignSelf: "flex-start",
    },
    typingDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
        backgroundColor: "#6B7280",
    },
    typingDotOffsetOne: {
        marginLeft: 4,
    },
    typingDotOffsetTwo: {
        marginLeft: 4,
    },
    errorText: {
        marginTop: spacing.xs,
        fontSize: 12,
        color: "#EF4444",
    },
});
