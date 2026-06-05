import { styles } from "./styles";
import { MessageComposer } from "@/components/MessageComposer";
import { MessageBubble } from "@/components/MessageBubble";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import InCallOverlay from "@/components/InCallOverlay";
import { useMessageAudioPlayback } from "@/hooks/useMessageAudioPlayback";
import { useMessageComposerMediaActions } from "@/hooks/useMessageComposerMediaActions";
import { MediaViewerModal } from "@/components/MediaViewerModal";
import { MessageContextMenu } from "@/components/MessageContextMenu";
import { UserAvatar } from "@/components";
import SelectGroupMembersModal from "@/components/SelectGroupMembersModal";
import { colors, spacing } from "@/constants";
import { useChatWindowController } from "@/hooks/useChatWindowController";
import { useFriendNotifications } from "@/hooks/useFriendNotifications";
import { useGroupManagement } from "@/hooks/useGroupManagement";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import chatService from "@/services/chatService";
import blockService from "@/services/blockService";
import friendService from "@/services/friendService";
import type { FriendEvent } from "@/services/friendWebsocketService";
import type {
    ChatUserSearchResult,
    ConversationMember,
    ConversationSidebar,
    DirectBlockStatusChangedEvent,
    LocalUploadFile,
    Message,
} from "@/types/chat";
import { formatRelativeTime } from "@/utils/format";
import { formatLastActiveText } from "@/utils/presenceText";
import { focusComposerInput } from "@/utils/focusComposerInput";
import { buildConversationDisplayInfo } from "@/utils/conversationDisplayInfo";
import { LOCKED_ACCOUNT_NAME } from "@/utils/lockedAccount";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
    type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Audio, type AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, usePreventRemove } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    ActivityIndicator,
    BackHandler,
    Dimensions,
    DeviceEventEmitter,
    Easing,
    FlatList,
    type GestureResponderEvent,
    Image,
    KeyboardAvoidingView,
    type LayoutChangeEvent,
    Linking,
    Modal,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    MENU_WIDTH,
    MENU_HORIZONTAL_MARGIN,
    MENU_VERTICAL_MARGIN,
    MENU_ESTIMATED_HEIGHT,
    LOAD_OLDER_TRIGGER_PX,
    LOAD_NEWER_TRIGGER_PX,
    STICKY_BOTTOM_THRESHOLD_PX,
    SHOW_SCROLL_BUTTON_THRESHOLD_PX,
    RIGHT_SCROLL_CUE_TRIGGER_PX,
    RIGHT_SCROLL_CUE_HIDE_MS,
    RIGHT_SCROLL_CUE_HEIGHT,
    RIGHT_SCROLL_CUE_MARGIN,
    JUMP_SCROLL_LOCK_MS,
    JUMP_AUTO_PAGING_SUPPRESS_MS,
    QUICK_EMOJIS,
    ContextMenuState,
    ReplyComposerState,
    MediaViewerState,
    AudioProgress,
    PinSystemRunRenderMeta,
    contextActions,
    formatDurationMillis,
    formatFileSize,
    resolveMediaUrl,
    resolveAttachmentUrls,
    isLikelyStoragePathOrUrl,
    formatMessageTime,
    isEmojiOnlyText,
    formatReplyLabel,
    getFileBadgeLabel,
    resolvePinSystemPreview,
    parseCallMeta,
    isSystemMessageType,
    buildReplyPreview,
    normalizeSearchText,
    inferReplyPreviewType,
    buildAudioWaveBars,
} from "@/utils/messageUtils";
import { PinnedBanner } from "@/components/PinnedBanner";
import AIChatSheet from "@/features/chat-ai/components/AIChatSheet";
import AIConsentModal from "@/features/chat-ai/components/AIConsentModal";
import { useChatAI } from "@/features/chat-ai/hooks/useChatAI";
import type { MessagePreviewDTO } from "@/features/chat-ai/types/chatAI";
import {
    ConversationSearchProvider,
    useConversationSearch,
} from "@/contexts/ConversationSearchContext";
import { buildPinnedBannerItemsFromSnapshot } from "@/utils/pinnedMessageSnapshot";
import { useOneToOneCall } from "@/hooks/useOneToOneCall";
import { consumeInviteReturnSync } from "@/utils/inviteReturnSync";
import { consumePendingIncomingCall } from "@/utils/pendingIncomingCall";
import chatRuntimeStore from "@/stores/chatRuntimeStore";

const FORWARD_BLOCKED_MEMBER_STATUSES = new Set([
    "LEFT",
    "KICKED",
    "BLOCKED",
    "GROUP_DISBANDED",
]);
const CALL_BLOCKED_MEMBER_STATUSES = new Set([
    "LEFT",
    "KICKED",
    "BLOCKED",
    "GROUP_DISBANDED",
]);

function canForwardToConversation(
    conversation: ConversationSidebar,
    currentUserId: number,
): boolean {
    if (conversation.lastMessage?.lastMessageType === "SYSTEM_DISBAND_GROUP") {
        return false;
    }

    const currentMember = conversation.members?.find(
        (member) => Number(member.userId) === Number(currentUserId),
    );

    if (!currentMember) return true;
    return !FORWARD_BLOCKED_MEMBER_STATUSES.has(String(currentMember.status));
}

function getMessagePreviewForAI(message: Message): string {
    if (message.isRecalled) return "";
    if (message.type === "IMAGE") return "[Hình ảnh]";
    if (message.type === "VIDEO") return "[Video]";
    if (message.type === "AUDIO") return "[Tin nhắn thoại]";
    if (message.type === "FILE") return "[Tệp đính kèm]";
    if (message.type === "POLL") return "[Bình chọn]";
    if (message.type === "CALL") return "[Cuộc gọi]";
    if (message.type.startsWith("SYSTEM_")) return "";
    return message.content || "";
}

function getLocalDateStart(dateValue: string): string | null {
    const [year, month, day] = dateValue.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function getLocalDateEndExclusive(dateValue: string): string | null {
    const [year, month, day] = dateValue.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day + 1, 0, 0, 0, 0).toISOString();
}

function formatDateInput(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | undefined {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function isInvalidDateRange(fromValue: string, toValue: string): boolean {
    return Boolean(fromValue && toValue && toValue < fromValue);
}

function ConversationSearchBar({
    members,
    currentUserId,
    onClose,
}: {
    members: ConversationMember[];
    currentUserId: number;
    onClose: () => void;
}) {
    const [inputValue, setInputValue] = useState("");
    const [senderMenuOpen, setSenderMenuOpen] = useState(false);
    const [senderQuery, setSenderQuery] = useState("");
    const [fromDateValue, setFromDateValue] = useState("");
    const [toDateValue, setToDateValue] = useState("");
    const [activeDatePicker, setActiveDatePicker] = useState<"from" | "to" | null>(null);
    const {
        keyword,
        senderId,
        results,
        currentIndex,
        hasMore,
        loading,
        search,
        setSenderFilter,
        setDateFilter,
        next,
        prev,
        clear,
    } = useConversationSearch();
    const applyDateRange = useCallback(
        (nextFromValue: string, nextToValue: string) => {
            if (isInvalidDateRange(nextFromValue, nextToValue)) {
                void setDateFilter(null, null);
                return;
            }
            const nextFrom =
                nextFromValue.length === 10
                    ? getLocalDateStart(nextFromValue)
                    : null;
            const nextTo =
                nextToValue.length === 10
                    ? getLocalDateEndExclusive(nextToValue)
                    : null;
            void setDateFilter(nextFrom, nextTo);
        },
        [setDateFilter],
    );
    const invalidDateRange = isInvalidDateRange(fromDateValue, toDateValue);
    const handleDatePickerChange = useCallback(
        (event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === "dismissed") {
                setActiveDatePicker(null);
                return;
            }
            if (!selectedDate || !activeDatePicker) return;

            const nextValue = formatDateInput(selectedDate);
            if (activeDatePicker === "from") {
                setFromDateValue(nextValue);
                applyDateRange(nextValue, toDateValue);
            } else {
                setToDateValue(nextValue);
                applyDateRange(fromDateValue, nextValue);
            }
            setActiveDatePicker(null);
        },
        [activeDatePicker, applyDateRange, fromDateValue, toDateValue],
    );
    const selectedSender = senderId
        ? members.find((member) => Number(member.userId) === Number(senderId))
        : null;
    const senderLabel = selectedSender
        ? selectedSender.userId === currentUserId
            ? "Ban"
            : selectedSender.nickname || selectedSender.username || `User ${selectedSender.userId}`
        : "Tat ca";
    const normalizedSenderQuery = senderQuery.trim().toLowerCase();
    const filteredMembers = normalizedSenderQuery
        ? members.filter((member) =>
              [
                  member.nickname,
                  member.username,
                  member.userId === currentUserId ? "Ban" : "",
              ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase()
                  .includes(normalizedSenderQuery),
          )
        : members;

    const statusText =
        results.length === 0
            ? keyword
                ? "Khong co ket qua"
                : "Nhap tu khoa"
            : hasMore
              ? `Ket qua thu ${currentIndex + 1}/${results.length}+`
              : `Ket qua thu ${currentIndex + 1}/${results.length}`;

    return (
        <View style={searchStyles.wrap}>
            <View style={searchStyles.inputWrap}>
                <Ionicons name="search-outline" size={18} color="#64748B" />
                <TextInput
                    value={inputValue}
                    onChangeText={setInputValue}
                    onSubmitEditing={() => void search(inputValue)}
                    placeholder="Tim tin nhan"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="search"
                    autoFocus
                    style={searchStyles.input}
                />
            </View>
            <Pressable
                style={searchStyles.senderBtn}
                onPress={() => setSenderMenuOpen((prev) => !prev)}
                hitSlop={8}
            >
                <Ionicons name="person-outline" size={16} color="#334155" />
                <Text style={searchStyles.senderBtnText} numberOfLines={1}>
                    {senderLabel}
                </Text>
            </Pressable>
            <Text style={searchStyles.status}>
                {loading ? "Dang tim..." : statusText}
            </Text>
            <Pressable
                style={[searchStyles.iconBtn, (loading || currentIndex <= 0) && searchStyles.iconBtnDisabled]}
                disabled={loading || currentIndex <= 0}
                onPress={() => void prev()}
                hitSlop={8}
            >
                <Ionicons name="chevron-up" size={20} color="#334155" />
            </Pressable>
            <Pressable
                style={[
                    searchStyles.iconBtn,
                    (loading || (currentIndex >= results.length - 1 && !hasMore)) &&
                        searchStyles.iconBtnDisabled,
                ]}
                disabled={loading || (currentIndex >= results.length - 1 && !hasMore)}
                onPress={() => void next()}
                hitSlop={8}
            >
                <Ionicons name="chevron-down" size={20} color="#334155" />
            </Pressable>
            <Pressable
                style={searchStyles.iconBtn}
                onPress={() => {
                    clear();
                    onClose();
                }}
                hitSlop={8}
            >
                <Ionicons name="close" size={20} color="#334155" />
            </Pressable>
            <View style={searchStyles.dateRow}>
                <Pressable
                    style={searchStyles.dateInputWrap}
                    onPress={() => setActiveDatePicker("from")}
                >
                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                    <Text
                        style={[
                            searchStyles.dateInput,
                            !fromDateValue && searchStyles.datePlaceholder,
                        ]}
                    >
                        {fromDateValue || "Tu ngay"}
                    </Text>
                </Pressable>
                <Pressable
                    style={searchStyles.dateInputWrap}
                    onPress={() => setActiveDatePicker("to")}
                >
                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                    <Text
                        style={[
                            searchStyles.dateInput,
                            !toDateValue && searchStyles.datePlaceholder,
                        ]}
                    >
                        {toDateValue || "Den ngay"}
                    </Text>
                </Pressable>
                {fromDateValue || toDateValue ? (
                    <Pressable
                        style={searchStyles.clearDateBtn}
                        onPress={() => {
                            setFromDateValue("");
                            setToDateValue("");
                            void setDateFilter(null, null);
                        }}
                    >
                        <Text style={searchStyles.clearDateText}>Bo ngay</Text>
                    </Pressable>
                ) : null}
                {invalidDateRange ? (
                    <Text style={searchStyles.dateError}>
                        Den ngay khong duoc truoc tu ngay
                    </Text>
                ) : null}
            </View>
            {senderMenuOpen ? (
                <View style={searchStyles.senderMenu}>
                    <View style={searchStyles.senderSearchWrap}>
                        <Ionicons name="search-outline" size={16} color="#64748B" />
                        <TextInput
                            value={senderQuery}
                            onChangeText={setSenderQuery}
                            placeholder="Tim nguoi gui"
                            placeholderTextColor="#94A3B8"
                            style={searchStyles.senderSearchInput}
                        />
                    </View>
                    <Pressable
                        style={searchStyles.senderOption}
                        onPress={() => {
                            setSenderMenuOpen(false);
                            setSenderQuery("");
                            void setSenderFilter(null);
                        }}
                    >
                        <View style={searchStyles.allAvatar}>
                            <Text style={searchStyles.allAvatarText}>All</Text>
                        </View>
                        <Text style={searchStyles.senderOptionText}>Tat ca</Text>
                    </Pressable>
                    {filteredMembers.map((member) => {
                        const name =
                            member.userId === currentUserId
                                ? "Ban"
                                : member.nickname || member.username || `User ${member.userId}`;
                        return (
                            <Pressable
                                key={member.userId}
                                style={searchStyles.senderOption}
                                onPress={() => {
                                    setSenderMenuOpen(false);
                                    setSenderQuery("");
                                    void setSenderFilter(member.userId);
                                }}
                            >
                                <UserAvatar
                                    uri={member.avatar}
                                    name={name}
                                    size={30}
                                />
                                <Text style={searchStyles.senderOptionText} numberOfLines={1}>
                                    {name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}
            {activeDatePicker ? (
                <DateTimePicker
                    value={
                        parseDateInput(
                            activeDatePicker === "from"
                                ? fromDateValue
                                : toDateValue,
                        ) || new Date()
                    }
                    mode="date"
                    display="default"
                    maximumDate={
                        activeDatePicker === "from"
                            ? parseDateInput(toDateValue)
                            : undefined
                    }
                    minimumDate={
                        activeDatePicker === "to"
                            ? parseDateInput(fromDateValue)
                            : undefined
                    }
                    onChange={handleDatePickerChange}
                />
            ) : null}
        </View>
    );
}

export default function MessagesConversationScreen() {
    const {
        conversationId: conversationIdParam,
        refreshAt,
        pendingJoinNotice,
        backToMessages,
        peerFriendStatus,
        peerMutualGroupsCount,
        openMessageId,
        openSearch,
    } = useLocalSearchParams<{
        conversationId?: string;
        refreshAt?: string;
        pendingJoinNotice?: string;
        backToMessages?: string;
        peerFriendStatus?: string;
        peerMutualGroupsCount?: string;
        openMessageId?: string;
        openSearch?: string;
    }>();
    const conversationId = Number(conversationIdParam ?? 0);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const redirectingBackToMessagesRef = useRef(false);
    const [redirectingBackToMessages, setRedirectingBackToMessages] =
        useState(false);
    const goBackToMessagesRoot = useCallback(() => {
        if (redirectingBackToMessagesRef.current) return;
        redirectingBackToMessagesRef.current = true;
        setRedirectingBackToMessages(true);
        router.replace("/(tabs)/activity");
    }, [router]);

    const handleBackPress = useCallback(() => {
        if (backToMessages === "1") {
            goBackToMessagesRoot();
            return;
        }
        router.back();
    }, [backToMessages, goBackToMessagesRoot, router]);

    useEffect(() => {
        if (backToMessages !== "1") return;

        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                goBackToMessagesRoot();
                return true;
            },
        );

        return () => subscription.remove();
    }, [backToMessages, goBackToMessagesRoot]);

    usePreventRemove(
        backToMessages === "1" && !redirectingBackToMessages,
        goBackToMessagesRoot,
    );
    const handleAccessBlocked = useCallback(() => {
        router.replace("/(tabs)/activity");
    }, [router]);
    const [loadedRelationshipInfo, setLoadedRelationshipInfo] =
        useState<ChatUserSearchResult | null>(null);
    const [friendRequestSending, setFriendRequestSending] = useState(false);
    const [friendRequestSent, setFriendRequestSent] = useState(false);
    const [friendRequestReceived, setFriendRequestReceived] = useState(false);
    const [forceStrangerAfterBlock, setForceStrangerAfterBlock] = useState(false);
    const routeRelationshipInfo = useMemo(() => {
        if (!peerFriendStatus) return null;
        return {
            friendStatus: peerFriendStatus === "FRIEND" ? "FRIEND" : "STRANGER",
            mutualGroupsCount: Number(peerMutualGroupsCount ?? 0),
        };
    }, [peerFriendStatus, peerMutualGroupsCount]);
    const effectiveRelationshipInfo =
        loadedRelationshipInfo ?? routeRelationshipInfo;
    const peerRelationshipText = useMemo(() => {
        if (!effectiveRelationshipInfo) return null;
        const parts = [
            effectiveRelationshipInfo.friendStatus === "FRIEND" ? "Ban be" : "Nguoi la",
        ];
        const mutualGroupsCount = Number(effectiveRelationshipInfo.mutualGroupsCount ?? 0);
        if (mutualGroupsCount > 0) {
            parts.push(`Nhom chung (${mutualGroupsCount})`);
        }
        return parts.join(" · ");
    }, [effectiveRelationshipInfo]);

    const {
        currentUserId,
        messageText,
        setMessageText,
        conversation,
        membersById,
        messages,
        pinnedMessages,
        readReceipts,
        typingUsers,
        loading,
        loadingMore,
        loadingNewer,
        hasMoreNewer,
        isHistoricalMode,
        sending,
        uploading,
        uploadProgressPercent,
        uploadProgressLabel,
        uploadFailedFileNames,
        readOnlyNotice,
        error,
        jumpToast,
        handleSend,
        handleSendMixedMedia,
        handleRecall,
        canRecallOwnMessages,
        handleDeleteForMe,
        handlePinMessage,
        handleUnpinMessage,
        addReaction,
        sendTypingSignal,
        loadOlderMessages,
        loadNewerMessages,
        handleJumpToMessage,
        resetToPresent,
        appendRealtimeMessage,
    } = useChatWindowController({
        conversationId: Number.isFinite(conversationId) ? conversationId : 0,
        onAccessBlocked: handleAccessBlocked,
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
    } = useChatAI({ conversationId: Number.isFinite(conversationId) ? conversationId : 0 });

    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
        null,
    );
    const [replyToMessage, setReplyToMessage] =
        useState<ReplyComposerState | null>(null);
    const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(
        null,
    );
    const [highlightedMessageId, setHighlightedMessageId] = useState<
        string | null
    >(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [aiSheetOpen, setAiSheetOpen] = useState(false);
    const openAIChat = useCallback(() => {
        setSearchOpen(false);
        setAiSheetOpen(true);
    }, []);

    useEffect(() => {
        if (consentModalOpen) {
            setAiSheetOpen(false);
        }
    }, [consentModalOpen]);

    useEffect(() => {
        if (openSearch === "1") {
            setSearchOpen(true);
        }
    }, [openSearch]);
    const [showScrollToBottomButton, setShowScrollToBottomButton] =
        useState(false);
    const [pendingNewMessages, setPendingNewMessages] = useState(0);
    const [jumpRequestToken, setJumpRequestToken] = useState(0);
    const [showPinnedList, setShowPinnedList] = useState(false);
    const [expandedPinSystemRuns, setExpandedPinSystemRuns] = useState<
        Record<string, boolean>
    >({});
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [showRightScrollCue, setShowRightScrollCue] = useState(false);
    const [rightScrollCueBaseTop, setRightScrollCueBaseTop] = useState(0);
    const [inputSelection, setInputSelection] = useState({
        start: 0,
        end: 0,
    });
    const [forwardSourceMessage, setForwardSourceMessage] =
        useState<Message | null>(null);
    const [forwardConversations, setForwardConversations] = useState<
        ConversationSidebar[]
    >([]);
    const [forwardSelectedIds, setForwardSelectedIds] = useState<Set<number>>(
        () => new Set(),
    );
    const [forwardLoading, setForwardLoading] = useState(false);
    const [forwardSubmitting, setForwardSubmitting] = useState(false);
    const [forwardError, setForwardError] = useState<string | null>(null);

    useEffect(() => {
        if (!refreshAt) return;
        void resetToPresent();
        if (pendingJoinNotice === "1") {
            Alert.alert(
                "Đang chờ phê duyệt",
                "Yêu cầu tham gia nhóm của bạn đã được gửi đến trưởng/phó nhóm.",
            );
        }
    }, [pendingJoinNotice, refreshAt, resetToPresent]);

    useFocusEffect(
        useCallback(() => {
            if (!Number.isFinite(conversationId)) return undefined;
            if (consumeInviteReturnSync(conversationId)) {
                void resetToPresent();
            }
            return undefined;
        }, [conversationId, resetToPresent]),
    );

    // Mapping web -> mobile:
    // - useGroupManagement giu nguyen API/state flow cua web.
    // - UI duoc hien thi trong modal thay cho side panel desktop.
    const {
        selectedGroupConversation,
        canManageMembers,
        canAddMembers,
        canUpdateRole,
        canDisbandGroup,
        groupMemberIds,
        availableFriends,
        friendsLoading,
        friendsError,
        isAddMembersModalOpen,
        isAddingMembers,
        isLeavingGroup,
        isDisbandingGroup,
        isTransferOwnerModalOpen,
        pendingKickUserId,
        pendingRoleUserId,
        pendingTransferOwnerUserId,
        ownerTransferCandidates,
        actionError,
        openAddMembersModal,
        closeAddMembersModal,
        closeTransferOwnerModal,
        addMembersToGroup,
        updateMemberRole,
        kickMember,
        leaveGroup,
        transferOwnershipAndLeave,
        disbandGroup,
    } = useGroupManagement({
        currentUserId,
        selectedConversation: conversation,
        selectedConversationId: Number.isFinite(conversationId)
            ? conversationId
            : null,
        reloadConversations: async () => {
            await resetToPresent();
        },
        onClearSelection: () => {
            handleBackPress();
        },
    });

    const listRef = useRef<FlatList<Message>>(null);
    const messageInputRef = useRef<TextInput>(null);
    const latestMessageIdRef = useRef("");
    const isAtBottomRef = useRef(true);
    const stickToBottomRef = useRef(true);
    const didInitialAutoScrollRef = useRef(false);
    const userHasDraggedListRef = useRef(false);
    const listLayoutRef = useRef({ y: 0, height: 0 });
    const scrollMetricsRef = useRef({
        contentHeight: 0,
        layoutHeight: 0,
        offsetY: 0,
    });
    const rightScrollCueVisibleRef = useRef(false);
    const forceBottomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const jumpScrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const pendingJumpMessageIdRef = useRef<string | null>(null);
    const jumpScrollLockRef = useRef(false);
    const autoPagingSuppressedUntilRef = useRef(0);
    const autoPagingSuppressLogAtRef = useRef(0);
    const typingAutoScrollTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const rightScrollCueHideTimerRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const rightScrollCueOpacity = useRef(new Animated.Value(0)).current;
    const rightScrollCueTranslateY = useRef(new Animated.Value(0)).current;
    const {
        audioPlayPulse,
        audioIconFade,
        audioPressScale,
        audioSeekScale,
        activeSeekAudioKey,
        activePressAudioKey,
        audioLoadingKey,
        playingAudioKey,
        audioProgressMap,
        audioTrackWidthMap,
        setAudioTrackWidthMap,
        stopAndUnloadAudio,
        seekAudioByLocation,
        handleSeekInteractionStart,
        handleSeekInteractionEnd,
        handleAudioPressIn,
        handleAudioPressOut,
        seekAudioByDelta,
        toggleAudioPlayback,
        getAudioWaveBars,
        combinedAudioIconScale,
    } = useMessageAudioPlayback();
    const activeRecordingRef = useRef<Audio.Recording | null>(null);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );

    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);

    const otherUser = useMemo(() => {
        const members = Object.values(membersById);
        return (
            members.find((member) => member.userId !== currentUserId) ||
            members[0] ||
            null
        );
    }, [currentUserId, membersById]);
    const otherUserId = Number(otherUser?.userId);
    const directTargetUserId = useMemo(() => {
        const fromMember = Number(otherUser?.userId);
        if (Number.isFinite(fromMember) && fromMember !== currentUserId) {
            return fromMember;
        }

        const fromConversationMembers = Number(
            conversation?.members?.find(
                (member) => Number(member.userId) !== Number(currentUserId),
            )?.userId,
        );
        if (
            Number.isFinite(fromConversationMembers) &&
            fromConversationMembers !== currentUserId
        ) {
            return fromConversationMembers;
        }

        const fromConversation = Number(conversation?.directPartnerId);
        if (
            Number.isFinite(fromConversation) &&
            fromConversation !== currentUserId
        ) {
            return fromConversation;
        }

        return undefined;
    }, [
        conversation?.directPartnerId,
        conversation?.members,
        currentUserId,
        otherUser?.userId,
    ]);
    const isDirectConversation = conversation?.type === "DIRECT";
    const isDirectBlockedByMe =
        isDirectConversation && Boolean(conversation?.directBlockedByMe);
    const isDirectBlockedMe =
        isDirectConversation && Boolean(conversation?.directBlockedMe);
    const isDirectChatBlocked = isDirectBlockedByMe || isDirectBlockedMe;
    const resolvedPeerRelationshipText = isDirectChatBlocked || forceStrangerAfterBlock
        ? "Nguoi la"
        : peerRelationshipText;
    const presenceByUserId = usePresenceStatus([otherUserId]);
    const otherUserPresence = Number.isFinite(otherUserId)
        ? presenceByUserId[otherUserId]
        : undefined;
    const otherUserOnline = Boolean(
        conversation?.type === "DIRECT" &&
            !isDirectChatBlocked &&
            !forceStrangerAfterBlock &&
            Number.isFinite(otherUserId) &&
            otherUserPresence?.online,
    );
    const [presenceNow, setPresenceNow] = useState(() => Date.now());
    useEffect(() => {
        if (otherUserOnline || !otherUserPresence?.lastActiveAt) return;

        // Offline text tự nhảy phút/giờ ở client, không cần backend bắn event mỗi phút.
        const timer = setInterval(() => setPresenceNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, [otherUserOnline, otherUserPresence?.lastActiveAt]);
    const otherUserLastActiveText = formatLastActiveText(
        otherUserPresence?.lastActiveAt,
        presenceNow,
    );
    const headerStatusText =
        conversation?.type === "DIRECT"
            ? isDirectChatBlocked
                ? "Nguoi la"
                : forceStrangerAfterBlock
                ? "Nguoi la"
                : otherUserOnline
                ? "Đang hoạt động"
                : otherUserLastActiveText || resolvedPeerRelationshipText || "Không hoạt động"
            : null;

    useFriendNotifications(
        useCallback(
            (event: FriendEvent) => {
                if (!currentUserId || !otherUser?.userId) return;
                const senderId = Number(event.senderId);
                const receiverId = Number(event.receiverId);
                const matchesCurrentConversation =
                    (senderId === currentUserId &&
                        receiverId === Number(otherUser.userId)) ||
                    (senderId === Number(otherUser.userId) &&
                        receiverId === currentUserId);

                if (!matchesCurrentConversation) return;

                if (event.eventType === "friend-request") {
                    if (
                        senderId === Number(otherUser.userId) &&
                        receiverId === currentUserId
                    ) {
                        setFriendRequestSent(false);
                        setForceStrangerAfterBlock(false);
                        setFriendRequestReceived(true);
                        setLoadedRelationshipInfo((previous) =>
                            previous
                                ? { ...previous, friendStatus: "STRANGER" }
                                : {
                                      userId: Number(otherUser.userId),
                                      name:
                                          otherUser.nickname ||
                                          otherUser.username ||
                                          "",
                                      friendStatus: "STRANGER",
                                      mutualGroupsCount: 0,
                                  },
                        );
                    }
                    return;
                }

                if (event.eventType === "friend-accept") {
                    setFriendRequestSent(false);
                    setFriendRequestReceived(false);
                    setForceStrangerAfterBlock(false);
                    setLoadedRelationshipInfo((previous) =>
                        previous
                            ? { ...previous, friendStatus: "FRIEND" }
                            : {
                                  userId: Number(otherUser.userId),
                                  name:
                                      otherUser.nickname ||
                                      otherUser.username ||
                                      "",
                                  friendStatus: "FRIEND",
                                  mutualGroupsCount: 0,
                              },
                    );
                    return;
                }

                if (
                    event.eventType === "friend-reject" ||
                    event.eventType === "friend-cancel"
                ) {
                    setFriendRequestSent(false);
                    setFriendRequestReceived(false);
                    setLoadedRelationshipInfo((previous) =>
                        previous
                            ? { ...previous, friendStatus: "STRANGER" }
                            : previous,
                    );
                }
            },
            [currentUserId, otherUser?.nickname, otherUser?.userId, otherUser?.username],
        ),
    );

    useEffect(() => {
        setFriendRequestSent(false);
        setFriendRequestReceived(false);
        setFriendRequestSending(false);
        setForceStrangerAfterBlock(false);
    }, [otherUser?.userId]);

    const handleSendFriendRequest = useCallback(async () => {
        if (
            !currentUserId ||
            !otherUser?.userId ||
            friendRequestSending
        ) {
            return;
        }

        setFriendRequestSending(true);
        if (friendRequestReceived) {
            const ok = await friendService.acceptFriendRequest(
                otherUser.userId,
                currentUserId,
            );
            setFriendRequestSending(false);

            if (ok) {
                setForceStrangerAfterBlock(false);
                setFriendRequestReceived(false);
                setFriendRequestSent(false);
                setLoadedRelationshipInfo((previous) =>
                    previous
                        ? { ...previous, friendStatus: "FRIEND" }
                        : {
                              userId: Number(otherUser.userId),
                              name:
                                  otherUser.nickname ||
                                  otherUser.username ||
                                  "",
                              friendStatus: "FRIEND",
                              mutualGroupsCount: 0,
                          },
                );
                return;
            }

            Alert.alert("Thong bao", "Khong the chap nhan loi moi ket ban");
            return;
        }

        if (friendRequestSent) {
            setFriendRequestSent(false);
        }
        const ok = friendRequestSent
            ? await friendService.cancelFriendRequest(
                  currentUserId,
                  otherUser.userId,
              )
            : await friendService.sendFriendRequest(
                  currentUserId,
                  otherUser.userId,
              );
        setFriendRequestSending(false);

        if (ok) {
            if (!friendRequestSent) {
                setForceStrangerAfterBlock(false);
                setFriendRequestSent(true);
            }
            return;
        }

        if (friendRequestSent) {
            setFriendRequestSent(true);
        }

        Alert.alert(
            "Thong bao",
            friendRequestSent
                ? "Khong the huy loi moi ket ban"
                : "Khong the gui loi moi ket ban",
        );
    }, [
        currentUserId,
        friendRequestSending,
        friendRequestReceived,
        friendRequestSent,
        otherUser?.nickname,
        otherUser?.userId,
        otherUser?.username,
    ]);

    useEffect(() => {
        if (routeRelationshipInfo) {
            setLoadedRelationshipInfo(null);
            return;
        }
        if (conversation?.type !== "DIRECT" || !otherUser?.userId) {
            setLoadedRelationshipInfo(null);
            return;
        }

        let cancelled = false;
        chatService
            .getChatUserRelationship(otherUser.userId)
            .then((result) => {
                if (!cancelled) setLoadedRelationshipInfo(result);
            })
            .catch(() => {
                if (!cancelled) setLoadedRelationshipInfo(null);
            });

        return () => {
            cancelled = true;
        };
    }, [conversation?.type, otherUser?.userId, routeRelationshipInfo]);

    const conversationDisplayInfo = useMemo(() => {
        if (!conversation) return null;

        return buildConversationDisplayInfo({
            conversation,
            currentUserId,
            members: Object.values(membersById),
        });
    }, [conversation, currentUserId, membersById]);
    const applyDirectStrangerState = useCallback(() => {
        if (!directTargetUserId) return;
        setForceStrangerAfterBlock(true);
        setLoadedRelationshipInfo((previous) =>
            previous
                ? { ...previous, friendStatus: "STRANGER" }
                : {
                      userId: Number(directTargetUserId),
                      name:
                          otherUser?.nickname ||
                          otherUser?.username ||
                          "",
                      friendStatus: "STRANGER",
                      mutualGroupsCount: 0,
                  },
        );
    }, [directTargetUserId, otherUser?.nickname, otherUser?.username]);

    const handleUnblockDirectPartner = useCallback(async () => {
        if (!currentUserId || !directTargetUserId) return;
        try {
            await blockService.unblockUser(currentUserId, directTargetUserId);
            applyDirectStrangerState();
        } catch {
            Alert.alert("Thong bao", "Khong the bo chan");
        }
    }, [
        applyDirectStrangerState,
        currentUserId,
        directTargetUserId,
    ]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            "conversation-direct-block-status-changed",
            (event: DirectBlockStatusChangedEvent) => {
                if (!currentUserId || !directTargetUserId) return;
                if (Number(event.conversationId) !== Number(conversationId)) {
                    return;
                }

                const blockerId = Number(event.blockerId);
                const blockedId = Number(event.blockedId);
                const matchesCurrentDirect =
                    (blockerId === Number(currentUserId) &&
                        blockedId === Number(directTargetUserId)) ||
                    (blockerId === Number(directTargetUserId) &&
                        blockedId === Number(currentUserId));

                if (matchesCurrentDirect) {
                    applyDirectStrangerState();
                }
            },
        );

        return () => subscription.remove();
    }, [
        applyDirectStrangerState,
        conversationId,
        currentUserId,
        directTargetUserId,
    ]);

    const callMemberSource = useMemo(() => {
        const mergedMembers = new Map<number, ConversationMember>();
        for (const member of conversation?.members ?? []) {
            if (Number.isFinite(Number(member.userId))) {
                mergedMembers.set(Number(member.userId), member);
            }
        }
        for (const member of Object.values(membersById)) {
            if (Number.isFinite(Number(member.userId))) {
                mergedMembers.set(Number(member.userId), {
                    ...mergedMembers.get(Number(member.userId)),
                    ...member,
                });
            }
        }
        return Array.from(mergedMembers.values());
    }, [conversation?.members, membersById]);
    const isGroupConversation =
        String(conversation?.type ?? "").toUpperCase() === "GROUP" ||
        callMemberSource.length > 2;
    const [pendingIncomingCall, setPendingIncomingCall] = useState(() =>
        consumePendingIncomingCall(
            Number.isFinite(conversationId) ? conversationId : 0,
        ),
    );
    const clearPendingIncomingCall = useCallback(() => {
        setPendingIncomingCall(null);
    }, []);
  const {
        incomingCall,
        activeCall,
        rejoinableCall,
        busyCallUserId,
        callStatus,
        localStreamUrl,
        remoteStreamUrl,
        remoteStreamUrls,
        micEnabled,
        cameraEnabled,
        speakerEnabled,
        isCallSupported,
        callDurationText,
        startCall,
        rejoinActiveCall,
        clearBusyCallNotice,
        inviteUsersToCall,
        maxCallParticipants,
        acceptIncomingCall,
        rejectIncomingCall,
        endCall,
        toggleMic,
        toggleCamera,
        switchCamera,
        toggleSpeaker,
    } = useOneToOneCall({
        conversationId: Number.isFinite(conversationId) ? conversationId : 0,
        currentUserId,
        callerName:
            membersById[currentUserId]?.nickname ||
            membersById[currentUserId]?.username ||
            `Nguoi dung ${currentUserId}`,
        callerAvatar: membersById[currentUserId]?.avatar,
        targetUserId: directTargetUserId,
        targetUserIds: callMemberSource
            .filter((member) => member.userId !== currentUserId)
            .map((member) => member.userId),
        targetName: otherUser?.nickname || otherUser?.username,
        targetAvatar: otherUser?.avatar,
        pendingIncomingCall,
        onPendingIncomingCallConsumed: clearPendingIncomingCall,
        onCallMessageSaved: appendRealtimeMessage,
    });

    useEffect(() => {
        if (!busyCallUserId) return;
        const member = membersById[busyCallUserId];
        const name =
            member?.nickname ||
            member?.username ||
            `Nguoi dung ${busyCallUserId}`;
        Alert.alert("Dang ban", `${name} dang ban trong cuoc goi khac`);
        clearBusyCallNotice();
    }, [busyCallUserId, clearBusyCallNotice, membersById]);

    const incomingCallerName = useMemo(() => {
        const incomingCallerId = incomingCall?.fromUserId ?? null;
        if (!incomingCallerId) return "Nguoi dung";

        const member = membersById[incomingCallerId];
        return (
            member?.nickname ||
            member?.username ||
            `Nguoi dung ${incomingCallerId}`
        );
    }, [incomingCall?.fromUserId, membersById]);

    const callableMembers = useMemo(
        () =>
            callMemberSource.filter((member) => {
                const status = String(member.status ?? "ACTIVE").toUpperCase();
                return (
                    member.userId !== currentUserId &&
                    !CALL_BLOCKED_MEMBER_STATUSES.has(status) &&
                    !member.accountLocked
                );
            }),
        [callMemberSource, currentUserId],
    );
    const [callPickerVisible, setCallPickerVisible] = useState(false);
    const [callPickerMode, setCallPickerMode] = useState<"start" | "invite">("start");
    const [callPickerType, setCallPickerType] = useState<"audio" | "video">("audio");
    const [selectedCallMemberIds, setSelectedCallMemberIds] = useState<Set<number>>(new Set());
    const activeRemoteIds = useMemo(
        () => new Set(activeCall?.remoteUserIds ?? []),
        [activeCall?.remoteUserIds],
    );
    const callPickerMembers = useMemo(
        () =>
            callableMembers.filter((member) =>
                callPickerMode === "invite"
                    ? !activeRemoteIds.has(member.userId)
                    : true,
            ),
        [activeRemoteIds, callableMembers, callPickerMode],
    );
    const callPickerLimit = Math.max(
        0,
        maxCallParticipants -
            (callPickerMode === "invite"
                ? 1 + (activeCall?.remoteUserIds.length ?? 0)
                : 1),
    );
    const callParticipants = useMemo(() => {
        if (!activeCall) return [];
        const ids = new Set(
            activeCall.participantUserIds?.length
                ? activeCall.participantUserIds
                : activeCall.remoteUserIds,
        );
        ids.add(currentUserId);
        return Object.values(membersById)
            .filter((member) => ids.has(member.userId))
            .map((member) => ({
                userId: member.userId,
                name: member.nickname || member.username || "Nguoi dung",
                avatar: member.avatar,
            }));
    }, [activeCall, currentUserId, membersById]);
    const hasInviteCallCandidates = useMemo(
        () => callableMembers.some((member) => !activeRemoteIds.has(member.userId)),
        [activeRemoteIds, callableMembers],
    );

    const openCallPicker = useCallback(
        (mode: "start" | "invite", callType: "audio" | "video") => {
            setCallPickerMode(mode);
            setCallPickerType(callType);
            setSelectedCallMemberIds(new Set());
            setCallPickerVisible(true);
        },
        [],
    );
    const showAlreadyInCallError = useCallback(() => {
        Alert.alert(
            "Khong the goi",
            "Ban dang trong mot cuoc goi khac. Hay ket thuc cuoc goi hien tai truoc.",
        );
    }, []);
    const isStartingAnotherCall = useCallback(() => {
        if (activeCall) return true;
        const runtimeCall = chatRuntimeStore.getActiveCall();
        return Boolean(runtimeCall && runtimeCall.userId === currentUserId);
    }, [activeCall, currentUserId]);

    const toggleCallMember = useCallback(
        (memberId: number) => {
            setSelectedCallMemberIds((prev) => {
                const next = new Set(prev);
                if (next.has(memberId)) {
                    next.delete(memberId);
                    return next;
                }
                if (next.size >= callPickerLimit) return next;
                next.add(memberId);
                return next;
            });
        },
        [callPickerLimit],
    );

    const submitCallPicker = useCallback(async () => {
        const ids = Array.from(selectedCallMemberIds);
        if (!ids.length) return;
        if (callPickerMode === "invite") {
            await inviteUsersToCall(ids);
        } else {
            if (isStartingAnotherCall()) {
                showAlreadyInCallError();
                return;
            }
            await startCall(callPickerType, ids);
        }
        setCallPickerVisible(false);
        setSelectedCallMemberIds(new Set());
    }, [
        callPickerMode,
        callPickerType,
        isStartingAnotherCall,
        inviteUsersToCall,
        selectedCallMemberIds,
        showAlreadyInCallError,
        startCall,
    ]);

    const tryStartCall = useCallback(
        async (callType: "audio" | "video") => {
            if (!isCallSupported) {
                Alert.alert(
                    "Tinh nang chua ho tro",
                    "Call can development build vi Expo Go khong co native WebRTC.",
                );
                return;
            }

            if (isStartingAnotherCall()) {
                showAlreadyInCallError();
                return;
            }

            if (isGroupConversation && callableMembers.length > 0) {
                openCallPicker("start", callType);
                return;
            }

            if (!isGroupConversation && isDirectChatBlocked) {
                Alert.alert("Khong the goi", "Ban khong the goi nguoi nay.");
                return;
            }

            if (!isGroupConversation && !directTargetUserId) {
                Alert.alert(
                    "Khong the goi",
                    "Chua xac dinh duoc nguoi nhan cuoc goi trong doan chat nay.",
                );
                return;
            }

            await startCall(callType);
        },
        [
            callableMembers.length,
            directTargetUserId,
            isDirectChatBlocked,
            isStartingAnotherCall,
            isCallSupported,
            isGroupConversation,
            openCallPicker,
            showAlreadyInCallError,
            startCall,
        ],
    );

    const typingParticipantIds = useMemo(
        () =>
            Array.from(typingUsers).filter(
                (userId) => userId !== currentUserId,
            ),
        [currentUserId, typingUsers],
    );

    const typingDotAnimations = useRef([
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
    ]).current;

    useEffect(() => {
        if (typingParticipantIds.length === 0) {
            typingDotAnimations.forEach((value) => value.setValue(0));
            return;
        }

        const loops = typingDotAnimations.map((value, index) => {
            const cycle = Animated.sequence([
                Animated.delay(index * 120),
                Animated.timing(value, {
                    toValue: 1,
                    duration: 260,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(value, {
                    toValue: 0,
                    duration: 320,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.delay(180),
            ]);

            const loop = Animated.loop(cycle);
            loop.start();
            return loop;
        });

        return () => {
            loops.forEach((loop) => loop.stop());
            typingDotAnimations.forEach((value) => value.setValue(0));
        };
    }, [typingDotAnimations, typingParticipantIds.length]);

    const selectedMessagePinned = useMemo(() => {
        if (!contextMenu) return false;
        return pinnedMessages.some(
            (pin) => pin.messageId === contextMenu.messageId,
        );
    }, [contextMenu, pinnedMessages]);

    const scheduleReleaseJumpScrollLock = useCallback((delayMs = 0) => {
        if (jumpScrollLockTimerRef.current) {
            clearTimeout(jumpScrollLockTimerRef.current);
            jumpScrollLockTimerRef.current = null;
        }

        if (delayMs <= 0) {
            jumpScrollLockRef.current = false;
            return;
        }

        jumpScrollLockTimerRef.current = setTimeout(() => {
            jumpScrollLockRef.current = false;
            jumpScrollLockTimerRef.current = null;
        }, delayMs);
    }, []);

    const focusAndHighlightMessage = useCallback(
        (messageId: string): boolean => {
            const index = messages.findIndex(
                (message) => message.id === messageId,
            );
            if (index < 0) return false;

            const tryScroll = (attempt: number) => {
                requestAnimationFrame(() => {
                    try {
                        listRef.current?.scrollToIndex({
                            index,
                            animated: false,
                            viewPosition: 0.5,
                        });
                    } catch {
                        const fallbackOffset = Math.max(index * 92 - 140, 0);
                        listRef.current?.scrollToOffset({
                            offset: fallbackOffset,
                            animated: false,
                        });

                        if (attempt < 4) {
                            setTimeout(() => {
                                tryScroll(attempt + 1);
                            }, 120);
                        }
                    }
                });
            };

            tryScroll(0);
            setHighlightedMessageId(messageId);
            setTimeout(() => {
                setHighlightedMessageId((prev) =>
                    prev === messageId ? null : prev,
                );
            }, 1400);

            return true;
        },
        [messages],
    );

    const requestJumpToMessage = useCallback(
        async (messageId: string) => {
            pendingJumpMessageIdRef.current = messageId;
            jumpScrollLockRef.current = true;
            scheduleReleaseJumpScrollLock(JUMP_SCROLL_LOCK_MS);
            autoPagingSuppressedUntilRef.current =
                Date.now() + JUMP_AUTO_PAGING_SUPPRESS_MS;

            latestMessageIdRef.current = "";
            stickToBottomRef.current = false;
            isAtBottomRef.current = false;
            setShowScrollToBottomButton(true);
            setPendingNewMessages(0);

            const ok = await handleJumpToMessage(messageId);
            if (!ok) {
                pendingJumpMessageIdRef.current = null;
                scheduleReleaseJumpScrollLock(0);
                autoPagingSuppressedUntilRef.current = 0;
                return;
            }

            console.log("[JUMP_DEBUG][screen] requestJumpToMessage:loaded", {
                conversationId,
                messageId,
            });
            setJumpRequestToken((token) => token + 1);
        },
        [
            conversationId,
            handleJumpToMessage,
            messages.length,
            scheduleReleaseJumpScrollLock,
        ],
    );

    useEffect(() => {
        const pendingId = pendingJumpMessageIdRef.current;
        if (!pendingId) return;

        const focused = focusAndHighlightMessage(pendingId);
        if (!focused) return;

        pendingJumpMessageIdRef.current = null;
        scheduleReleaseJumpScrollLock(700);
    }, [
        focusAndHighlightMessage,
        jumpRequestToken,
        messages.length,
        scheduleReleaseJumpScrollLock,
    ]);

    const pinnedBannerItems = useMemo(
        () =>
            buildPinnedBannerItemsFromSnapshot({
                pins: pinnedMessages,
                membersById,
            }),
        [membersById, pinnedMessages],
    );

    const primaryPinnedItem = pinnedBannerItems[0];
    const canExpandPinnedList = pinnedBannerItems.length > 1;

    const systemRunMetaByIndex = useMemo(() => {
        const meta = new Map<number, PinSystemRunRenderMeta>();

        for (let cursor = 0; cursor < messages.length; ) {
            const current = messages[cursor];
            if (!isSystemMessageType(current.type)) {
                cursor += 1;
                continue;
            }

            const runStart = cursor;
            while (
                cursor < messages.length &&
                isSystemMessageType(messages[cursor].type)
            ) {
                cursor += 1;
            }

            const runEnd = cursor - 1;
            const runLength = runEnd - runStart + 1;
            const runKey = messages[runStart]?.id || `sys-run-${runStart}`;

            if (runLength < 3) {
                for (let index = runStart; index <= runEnd; index += 1) {
                    meta.set(index, {
                        runKey,
                        runLength,
                        shouldRenderCollapsedButton: false,
                        shouldHideMessage: false,
                    });
                }
                continue;
            }

            const expanded = Boolean(expandedPinSystemRuns[runKey]);
            for (let index = runStart; index <= runEnd; index += 1) {
                meta.set(index, {
                    runKey,
                    runLength,
                    shouldRenderCollapsedButton:
                        !expanded && index === runStart,
                    shouldHideMessage: !expanded && index !== runStart,
                });
            }
        }

        return meta;
    }, [expandedPinSystemRuns, messages]);

    const handleExpandPinSystemRun = useCallback((runKey: string) => {
        setExpandedPinSystemRuns((prev) => ({
            ...prev,
            [runKey]: true,
        }));
    }, []);

    useEffect(() => {
        if (!canExpandPinnedList && showPinnedList) {
            setShowPinnedList(false);
        }
    }, [canExpandPinnedList, showPinnedList]);

    const handleOpenPinnedMessage = useCallback(
        (messageId: string) => {
            void requestJumpToMessage(messageId);
            setShowPinnedList(false);
        },
        [requestJumpToMessage],
    );

    useEffect(() => {
        if (!openMessageId) return;
        void requestJumpToMessage(String(openMessageId));
    }, [openMessageId, requestJumpToMessage]);

    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            const activeRecording = activeRecordingRef.current;
            activeRecordingRef.current = null;
            if (activeRecording) {
                void activeRecording
                    .stopAndUnloadAsync()
                    .catch(() => undefined);
            }

            void Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            }).catch(() => undefined);
        };
    }, []);

    const closeMediaViewer = useCallback(() => {
        setMediaViewer(null);
    }, []);

    const scrollToConversationBottom = useCallback((animated = true) => {
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated });
        });
    }, []);

    const updateRightScrollCuePosition = useCallback(() => {
        const { contentHeight, layoutHeight, offsetY } =
            scrollMetricsRef.current;
        const { height: listHeight } = listLayoutRef.current;
        const maxScrollable = Math.max(contentHeight - layoutHeight, 0);
        const ratio =
            maxScrollable > 0
                ? Math.min(Math.max(offsetY / maxScrollable, 0), 1)
                : 0;
        const cueTravel = Math.max(
            listHeight - RIGHT_SCROLL_CUE_HEIGHT - RIGHT_SCROLL_CUE_MARGIN * 2,
            0,
        );
        const nextTranslateY = ratio * cueTravel;
        rightScrollCueTranslateY.setValue(nextTranslateY);
    }, [rightScrollCueTranslateY]);

    const forceScrollToBottom = useCallback(
        (animated = false) => {
            if (forceBottomTimeoutRef.current) {
                clearTimeout(forceBottomTimeoutRef.current);
                forceBottomTimeoutRef.current = null;
            }

            scrollMetricsRef.current.offsetY = Math.max(
                scrollMetricsRef.current.contentHeight -
                    scrollMetricsRef.current.layoutHeight,
                0,
            );
            updateRightScrollCuePosition();

            scrollToConversationBottom(animated);
            forceBottomTimeoutRef.current = setTimeout(() => {
                scrollMetricsRef.current.offsetY = Math.max(
                    scrollMetricsRef.current.contentHeight -
                        scrollMetricsRef.current.layoutHeight,
                    0,
                );
                updateRightScrollCuePosition();
                listRef.current?.scrollToEnd({ animated: false });
                forceBottomTimeoutRef.current = null;
            }, 70);
        },
        [scrollToConversationBottom, updateRightScrollCuePosition],
    );

    const hideRightScrollCue = useCallback(() => {
        if (rightScrollCueHideTimerRef.current) {
            clearTimeout(rightScrollCueHideTimerRef.current);
            rightScrollCueHideTimerRef.current = null;
        }

        if (!rightScrollCueVisibleRef.current) {
            setShowRightScrollCue(false);
            rightScrollCueOpacity.setValue(0);
            return;
        }

        Animated.timing(rightScrollCueOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
        }).start(() => {
            rightScrollCueVisibleRef.current = false;
            setShowRightScrollCue(false);
        });
    }, [rightScrollCueOpacity]);

    const showRightScrollCueTemporarily = useCallback(() => {
        if (rightScrollCueHideTimerRef.current) {
            clearTimeout(rightScrollCueHideTimerRef.current);
            rightScrollCueHideTimerRef.current = null;
        }

        updateRightScrollCuePosition();

        if (!rightScrollCueVisibleRef.current) {
            rightScrollCueVisibleRef.current = true;
            setShowRightScrollCue(true);

            rightScrollCueOpacity.stopAnimation();
            rightScrollCueOpacity.setValue(0);
            Animated.timing(rightScrollCueOpacity, {
                toValue: 1,
                duration: 110,
                useNativeDriver: true,
            }).start();
        }

        rightScrollCueHideTimerRef.current = setTimeout(() => {
            hideRightScrollCue();
        }, RIGHT_SCROLL_CUE_HIDE_MS);
    }, [
        hideRightScrollCue,
        rightScrollCueOpacity,
        updateRightScrollCuePosition,
    ]);

    const handleListLayout = useCallback(
        (event: LayoutChangeEvent) => {
            const { y, height } = event.nativeEvent.layout;
            listLayoutRef.current = { y, height };
            scrollMetricsRef.current.layoutHeight = height;
            const nextBaseTop = y + RIGHT_SCROLL_CUE_MARGIN;

            setRightScrollCueBaseTop((prev) =>
                Math.abs(prev - nextBaseTop) < 1 ? prev : nextBaseTop,
            );

            if (stickToBottomRef.current) {
                scrollMetricsRef.current.offsetY = Math.max(
                    scrollMetricsRef.current.contentHeight - height,
                    0,
                );
            }

            updateRightScrollCuePosition();
        },
        [updateRightScrollCuePosition],
    );

    const handleContentSizeChange = useCallback(
        (_width: number, height: number) => {
            scrollMetricsRef.current.contentHeight = height;

            if (jumpScrollLockRef.current) {
                updateRightScrollCuePosition();
                return;
            }

            if (isHistoricalMode) {
                updateRightScrollCuePosition();
                return;
            }

            const shouldKeepTypingVisible =
                typingParticipantIds.length > 0 &&
                (stickToBottomRef.current || isAtBottomRef.current);

            if (!stickToBottomRef.current && !shouldKeepTypingVisible) {
                updateRightScrollCuePosition();
                return;
            }

            requestAnimationFrame(() => {
                forceScrollToBottom(false);
            });
        },
        [
            conversationId,
            forceScrollToBottom,
            isHistoricalMode,
            typingParticipantIds.length,
            updateRightScrollCuePosition,
        ],
    );

    useEffect(() => {
        latestMessageIdRef.current = "";
        isAtBottomRef.current = true;
        stickToBottomRef.current = true;
        didInitialAutoScrollRef.current = false;
        userHasDraggedListRef.current = false;
        setShowScrollToBottomButton(false);
        setPendingNewMessages(0);
        rightScrollCueVisibleRef.current = false;
        rightScrollCueTranslateY.setValue(0);
        setShowRightScrollCue(false);
        autoPagingSuppressedUntilRef.current = 0;
        autoPagingSuppressLogAtRef.current = 0;
        pendingJumpMessageIdRef.current = null;
        jumpScrollLockRef.current = false;
        scheduleReleaseJumpScrollLock(0);
        hideRightScrollCue();
    }, [
        conversationId,
        hideRightScrollCue,
        rightScrollCueTranslateY,
        scheduleReleaseJumpScrollLock,
    ]);

    useEffect(() => {
        if (loading) return;
        if (messages.length === 0) return;
        if (didInitialAutoScrollRef.current) return;
        if (jumpScrollLockRef.current) return;

        didInitialAutoScrollRef.current = true;
        autoPagingSuppressedUntilRef.current = Date.now() + 500;
        stickToBottomRef.current = true;
        isAtBottomRef.current = true;
        forceScrollToBottom(false);
    }, [forceScrollToBottom, loading, messages.length]);

    useEffect(() => {
        const newestMessage = messages.at(-1);
        if (!newestMessage) return;

        if (jumpScrollLockRef.current) {
            latestMessageIdRef.current = newestMessage.id;
            return;
        }

        if (isHistoricalMode) {
            if (latestMessageIdRef.current === newestMessage.id) {
                return;
            }

            const previousLatestMessageId = latestMessageIdRef.current;
            latestMessageIdRef.current = newestMessage.id;
            setShowScrollToBottomButton(true);

            if (!previousLatestMessageId) {
                return;
            }

            if (newestMessage.senderId !== currentUserId) {
                setPendingNewMessages((prev) => Math.min(prev + 1, 99));
            }
            return;
        }

        if (latestMessageIdRef.current === newestMessage.id) return;
        latestMessageIdRef.current = newestMessage.id;

        const shouldAutoScroll =
            newestMessage.senderId === currentUserId || isAtBottomRef.current;

        if (shouldAutoScroll) {
            stickToBottomRef.current = true;
            forceScrollToBottom(false);
            setShowScrollToBottomButton(false);
            setPendingNewMessages(0);
            return;
        }

        setShowScrollToBottomButton(true);
        if (newestMessage.senderId !== currentUserId) {
            setPendingNewMessages((prev) => Math.min(prev + 1, 99));
        }
    }, [
        conversationId,
        currentUserId,
        forceScrollToBottom,
        isHistoricalMode,
        messages,
    ]);

    useEffect(() => {
        if (typingParticipantIds.length === 0) return;
        if (jumpScrollLockRef.current) return;
        if (isHistoricalMode) return;

        if (typingAutoScrollTimeoutRef.current) {
            clearTimeout(typingAutoScrollTimeoutRef.current);
            typingAutoScrollTimeoutRef.current = null;
        }

        const shouldKeepTypingVisible =
            stickToBottomRef.current || isAtBottomRef.current;

        if (!shouldKeepTypingVisible) return;

        requestAnimationFrame(() => {
            forceScrollToBottom(false);
            setShowScrollToBottomButton(false);
            setPendingNewMessages(0);

            // Pass 2: xử lý trường hợp footer typing render trễ một nhịp.
            typingAutoScrollTimeoutRef.current = setTimeout(() => {
                forceScrollToBottom(false);
            }, 140);
        });
    }, [
        conversationId,
        forceScrollToBottom,
        isHistoricalMode,
        typingParticipantIds.length,
    ]);

    const handleListScrollBeginDrag = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            userHasDraggedListRef.current = true;
            autoPagingSuppressedUntilRef.current = 0;
            const distanceFromBottom =
                event.nativeEvent.contentSize.height -
                (event.nativeEvent.layoutMeasurement.height +
                    event.nativeEvent.contentOffset.y);

            if (distanceFromBottom > RIGHT_SCROLL_CUE_TRIGGER_PX) {
                showRightScrollCueTemporarily();
            }

            if (distanceFromBottom > SHOW_SCROLL_BUTTON_THRESHOLD_PX) {
                stickToBottomRef.current = false;
                setShowScrollToBottomButton(true);
            }
        },
        [showRightScrollCueTemporarily],
    );

    const onSend = async () => {
        setEmojiPickerOpen(false);
        sendTypingSignal(false);
        const sent = await handleSend(replyToMessage?.id);
        if (sent) {
            setReplyToMessage(null);
            scrollToConversationBottom(true);
            setShowScrollToBottomButton(false);
            setPendingNewMessages(0);
        }
    };

    const { onPickMediaAndSend, onCapturePhotoAndSend, onPickDocumentAndSend } =
        useMessageComposerMediaActions({
            handleSendMixedMedia,
            replyToMessageId: replyToMessage?.id,
            uploading,
            sending,
            onSendSuccess: () => {
                setReplyToMessage(null);
                scrollToConversationBottom(true);
            },
        });

    const stopRecordingTimer = useCallback(() => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    }, []);

    const finalizeRecording = useCallback(
        async (shouldSend: boolean) => {
            const recording = activeRecordingRef.current;
            if (!recording) return false;

            activeRecordingRef.current = null;
            stopRecordingTimer();
            setIsRecordingVoice(false);

            try {
                await recording.stopAndUnloadAsync();
            } catch {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                }).catch(() => undefined);
                setRecordingSeconds(0);
                return false;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            }).catch(() => undefined);

            if (!shouldSend) {
                setRecordingSeconds(0);
                return false;
            }

            const uri = recording.getURI();
            if (!uri) {
                setRecordingSeconds(0);
                return false;
            }

            const recordedFile: LocalUploadFile = {
                uri,
                fileName: `voice-${Date.now()}.m4a`,
                mimeType: "audio/m4a",
                fileSize: 1,
            };

            const sent = await handleSendMixedMedia(
                [recordedFile],
                undefined,
                replyToMessage?.id,
            );

            setRecordingSeconds(0);

            if (!sent) {
                Alert.alert("Thong bao", "Khong the gui tin nhan thoai");
                return false;
            }

            setReplyToMessage(null);
            scrollToConversationBottom(true);
            return true;
        },
        [
            handleSendMixedMedia,
            replyToMessage?.id,
            scrollToConversationBottom,
            stopRecordingTimer,
        ],
    );

    const onStartRecording = useCallback(async () => {
        if (uploading || sending || isRecordingVoice) return;

        try {
            setEmojiPickerOpen(false);
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("Thong bao", "Can cap quyen microphone de ghi am");
                return;
            }

            sendTypingSignal(false);

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
            );
            await recording.startAsync();

            activeRecordingRef.current = recording;
            setRecordingSeconds(0);
            setIsRecordingVoice(true);

            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds((prev) => prev + 1);
            }, 1000);
        } catch {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            }).catch(() => undefined);
            Alert.alert("Thong bao", "Khong the bat dau ghi am luc nay");
        }
    }, [isRecordingVoice, sending, sendTypingSignal, uploading]);

    const onStopRecordingAndSend = useCallback(async () => {
        if (!isRecordingVoice) return;
        await finalizeRecording(true);
    }, [finalizeRecording, isRecordingVoice]);

    const onCancelRecording = useCallback(async () => {
        if (!isRecordingVoice) return;
        await finalizeRecording(false);
    }, [finalizeRecording, isRecordingVoice]);

    const onToggleEmojiPicker = useCallback(() => {
        if (uploading || sending || isRecordingVoice) return;
        setEmojiPickerOpen((prev) => !prev);
    }, [isRecordingVoice, sending, uploading]);

    const onPickEmoji = useCallback(
        (emoji: string) => {
            const baseText = messageText;
            const start = Math.max(
                0,
                Math.min(inputSelection.start, baseText.length),
            );
            const end = Math.max(
                0,
                Math.min(inputSelection.end, baseText.length),
            );
            const nextText =
                baseText.slice(0, start) + emoji + baseText.slice(end);
            const nextCaret = start + emoji.length;

            setMessageText(nextText);
            sendTypingSignal(Boolean(nextText.trim()));
            setEmojiPickerOpen(false);
            setInputSelection({ start: nextCaret, end: nextCaret });

            requestAnimationFrame(() => {
                messageInputRef.current?.focus();
            });
        },
        [
            inputSelection.end,
            inputSelection.start,
            messageText,
            sendTypingSignal,
            setMessageText,
        ],
    );

    const hasTypedText = messageText.trim().length > 0;
    const currentMessagesForAISummary = useMemo<MessagePreviewDTO[]>(() => {
        return messages.slice(-100).reduce<MessagePreviewDTO[]>((result, message) => {
            const previewContent = getMessagePreviewForAI(message);
            if (!previewContent.trim()) return result;

            result.push({
                senderRole: message.senderId === currentUserId ? "me" : "other",
                content: previewContent,
                createdAt: message.createdAt,
            });

            return result;
        }, []);
    }, [currentUserId, messages]);

    const handleApplyAISuggestion = useCallback(
        (suggestion: string) => {
            setMessageText(suggestion);
            setInputSelection({
                start: suggestion.length,
                end: suggestion.length,
            });
            setAiSheetOpen(false);
            focusComposerInput(messageInputRef, { delayMs: 80 });
        },
        [setMessageText],
    );

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const replyToTargetMessage = useCallback(
        (targetMessage: Message) => {
            const senderName =
                membersById[targetMessage.senderId]?.nickname ||
                membersById[targetMessage.senderId]?.username ||
                "Nguoi dung";

            setReplyToMessage({
                id: targetMessage.id,
                senderName,
                content: buildReplyPreview(targetMessage),
            });

            closeContextMenu();
            focusComposerInput(messageInputRef, { delayMs: 80 });
        },
        [closeContextMenu, membersById],
    );

    const handleMessageLongPress = (
        event: GestureResponderEvent,
        messageId: string,
        mine: boolean,
    ) => {
        const { width, height } = Dimensions.get("window");
        const x = event.nativeEvent.pageX;
        const y = event.nativeEvent.pageY;
        const rawLeft = mine ? x - MENU_WIDTH + 34 : x - 18;
        const left = Math.min(
            Math.max(MENU_HORIZONTAL_MARGIN, rawLeft),
            width - MENU_WIDTH - MENU_HORIZONTAL_MARGIN,
        );
        const minTop = insets.top + MENU_VERTICAL_MARGIN;
        const top = Math.min(
            Math.max(minTop, y - 220),
            height - MENU_ESTIMATED_HEIGHT - MENU_VERTICAL_MARGIN,
        );

        setContextMenu({
            messageId,
            top,
            left,
            mine,
            minStackTop: insets.top + 72,
        });
    };

    const openForwardModal = useCallback(
        async (messageId: string) => {
            const source = messages.find((message) => message.id === messageId);
            if (!source) return;

            setForwardSourceMessage(source);
            setForwardSelectedIds(new Set());
            setForwardError(null);
            setForwardLoading(true);

            try {
                const response = await chatService.getForwardableConversations();
                setForwardConversations(
                    (response.data ?? []).filter((item) =>
                        canForwardToConversation(item, currentUserId),
                    ),
                );
            } catch {
                setForwardError("Khong the tai danh sach hoi thoai");
            } finally {
                setForwardLoading(false);
            }
        },
        [currentUserId, messages],
    );

    const closeForwardModal = useCallback(() => {
        if (forwardSubmitting) return;
        setForwardSourceMessage(null);
        setForwardSelectedIds(new Set());
        setForwardError(null);
    }, [forwardSubmitting]);

    const forwardViewerImage = useCallback(
        (url: string) => {
            const source = messages.find((message) =>
                resolveAttachmentUrls(message).includes(url),
            );
            if (!source) {
                Alert.alert(
                    "Thong bao",
                    "Chi co the chuyen tiep anh da tai trong doan chat hien tai.",
                );
                return;
            }
            setMediaViewer(null);
            void openForwardModal(source.id);
        },
        [messages, openForwardModal],
    );

    const toggleForwardTarget = useCallback((targetId: number) => {
        setForwardSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(targetId)) next.delete(targetId);
            else next.add(targetId);
            return next;
        });
    }, []);

    const submitForwardMessage = useCallback(async () => {
        if (!forwardSourceMessage || forwardSelectedIds.size === 0) return;

        try {
            setForwardSubmitting(true);
            setForwardError(null);
            await chatService.forwardMessage({
                sourceMessageId: forwardSourceMessage.id,
                targetConversationIds: Array.from(forwardSelectedIds),
            });
            setForwardSourceMessage(null);
            setForwardSelectedIds(new Set());
            Alert.alert("Thong bao", "Da chuyen tiep tin nhan");
        } catch (error) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                "Khong the chuyen tiep tin nhan";
            setForwardError(message);
        } finally {
            setForwardSubmitting(false);
        }
    }, [forwardSelectedIds, forwardSourceMessage]);

    const handleContextAction = (actionKey: string) => {
        if (!contextMenu) return;
        if (actionKey === "copy") {
            Alert.alert("Thông báo", "Đã chọn Copy tin nhắn.");
        }

        if (actionKey === "unsend") {
            void handleRecall(contextMenu.messageId);
        }

        if (actionKey === "delete-mine") {
            void handleDeleteForMe(contextMenu.messageId);
        }

        if (actionKey === "pin") {
            if (selectedMessagePinned) {
                void handleUnpinMessage(contextMenu.messageId);
            } else {
                void handlePinMessage(contextMenu.messageId);
            }
        }

        if (actionKey === "reply") {
            const targetMessage = messages.find(
                (message) => message.id === contextMenu.messageId,
            );

            if (targetMessage) {
                replyToTargetMessage(targetMessage);
                return;
            }
        }

        if (actionKey === "forward") {
            void openForwardModal(contextMenu.messageId);
        }

        closeContextMenu();
    };

    const handleListScroll = (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        const now = Date.now();
        const isAutoPagingSuppressed =
            jumpScrollLockRef.current ||
            now < autoPagingSuppressedUntilRef.current;

        scrollMetricsRef.current = {
            contentHeight: event.nativeEvent.contentSize.height,
            layoutHeight: event.nativeEvent.layoutMeasurement.height,
            offsetY: event.nativeEvent.contentOffset.y,
        };
        updateRightScrollCuePosition();

        if (
            userHasDraggedListRef.current &&
            didInitialAutoScrollRef.current &&
            event.nativeEvent.contentOffset.y <= LOAD_OLDER_TRIGGER_PX
        ) {
            if (!isAutoPagingSuppressed) {
                void loadOlderMessages();
            } else if (now - autoPagingSuppressLogAtRef.current > 700) {
                autoPagingSuppressLogAtRef.current = now;
            }
        }

        const distanceFromBottom =
            event.nativeEvent.contentSize.height -
            (event.nativeEvent.layoutMeasurement.height +
                event.nativeEvent.contentOffset.y);

        const isAtBottomStrict =
            distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX;
        const shouldShowScrollButton =
            isHistoricalMode ||
            distanceFromBottom > SHOW_SCROLL_BUTTON_THRESHOLD_PX;

        isAtBottomRef.current = isAtBottomStrict;

        if (isAtBottomStrict) {
            stickToBottomRef.current = true;
        } else {
            stickToBottomRef.current = false;
        }

        if (isAtBottomStrict) {
            hideRightScrollCue();
        }

        if (distanceFromBottom > RIGHT_SCROLL_CUE_TRIGGER_PX) {
            showRightScrollCueTemporarily();
        }

        if (!shouldShowScrollButton) {
            setShowScrollToBottomButton(false);
            setPendingNewMessages(0);
        } else {
            setShowScrollToBottomButton(true);
        }

        if (
            distanceFromBottom <= LOAD_NEWER_TRIGGER_PX &&
            isHistoricalMode &&
            hasMoreNewer
        ) {
            if (!isAutoPagingSuppressed) {
                void loadNewerMessages();
            } else if (now - autoPagingSuppressLogAtRef.current > 700) {
                autoPagingSuppressLogAtRef.current = now;
            }
        }
    };

    const handleScrollToIndexFailed = (info: {
        index: number;
        highestMeasuredFrameIndex: number;
        averageItemLength: number;
    }) => {
        const fallbackOffset = Math.max(
            info.index * Math.max(info.averageItemLength, 72) - 120,
            0,
        );

        listRef.current?.scrollToOffset({
            offset: fallbackOffset,
            animated: false,
        });

        setTimeout(() => {
            listRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0.5,
            });
        }, 180);
    };

    const handleScrollToBottomClick = useCallback(async () => {
        if (isHistoricalMode) {
            await resetToPresent();
        }

        autoPagingSuppressedUntilRef.current = 0;
        pendingJumpMessageIdRef.current = null;
        scheduleReleaseJumpScrollLock(0);
        stickToBottomRef.current = true;
        forceScrollToBottom(false);
        isAtBottomRef.current = true;
        setShowScrollToBottomButton(false);
        setPendingNewMessages(0);
        hideRightScrollCue();
    }, [
        forceScrollToBottom,
        hideRightScrollCue,
        isHistoricalMode,
        resetToPresent,
        scheduleReleaseJumpScrollLock,
    ]);

    useEffect(() => {
        return () => {
            if (forceBottomTimeoutRef.current) {
                clearTimeout(forceBottomTimeoutRef.current);
                forceBottomTimeoutRef.current = null;
            }

            if (jumpScrollLockTimerRef.current) {
                clearTimeout(jumpScrollLockTimerRef.current);
                jumpScrollLockTimerRef.current = null;
            }

            if (typingAutoScrollTimeoutRef.current) {
                clearTimeout(typingAutoScrollTimeoutRef.current);
                typingAutoScrollTimeoutRef.current = null;
            }

            if (rightScrollCueHideTimerRef.current) {
                clearTimeout(rightScrollCueHideTimerRef.current);
                rightScrollCueHideTimerRef.current = null;
            }
        };
    }, []);

    // Giống web: hiện loading nếu đang tải dữ liệu lần đầu
    if (loading && !conversation) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    // Chỉ hiện màn hình lỗi (error view) khi bị mất quyền truy cập hoàn toàn.
    // Nếu chỉ bị chặn gửi tin nhắn (readOnlyNotice chứa "Chỉ trưởng/phó nhóm") thì vẫn cho xem hội thoại.
    const isDirectBlockReadOnly =
        readOnlyNotice === "Bạn đã chặn người này." ||
        readOnlyNotice === "Bạn không thể nhắn tin với người này.";
    const isAccessBlocked = readOnlyNotice && !isDirectBlockReadOnly && (
        readOnlyNotice.includes("chặn") ||
        readOnlyNotice.includes("xóa") || 
        readOnlyNotice.includes("rời") || 
        readOnlyNotice.includes("giải tán") ||
        readOnlyNotice.includes("Không thể truy cập")
    );
    const normalizedReadOnlyNotice = readOnlyNotice?.toLowerCase() ?? "";
    const isPlainTextAccessBlocked =
        normalizedReadOnlyNotice.includes("chan") ||
        normalizedReadOnlyNotice.includes("xoa") ||
        normalizedReadOnlyNotice.includes("roi") ||
        normalizedReadOnlyNotice.includes("giai tan") ||
        normalizedReadOnlyNotice.includes("khong the truy cap");
    const isErrorState =
        Boolean(isAccessBlocked) ||
        isPlainTextAccessBlocked ||
        (!loading && !conversation);

    if (isErrorState) {
        const displayName =
            conversationDisplayInfo?.name ||
            otherUser?.nickname ||
            otherUser?.username ||
            "Cuộc trò chuyện";

        // Xác định tiêu đề lỗi cụ thể
        const isDisbanded =
            readOnlyNotice?.toLowerCase().includes("giải tán") ||
            readOnlyNotice?.toLowerCase().includes("giai tan");

        const errorTitle = isDisbanded
            ? "Nhóm đã bị giải tán."
            : readOnlyNotice || "Không thể truy cập";

        return (
            <SafeAreaView style={styles.container}>
                {/* Header tĩnh cho trạng thái lỗi */}
                {!searchOpen ? (
                <View style={styles.header}>
                    <Pressable
                        style={styles.headerBackBtn}
                        onPress={handleBackPress}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color={colors.text}
                        />
                    </Pressable>
                    <View style={styles.headerIdentity}>
                        <UserAvatar
                            uri={conversationDisplayInfo?.locked ? undefined : conversationDisplayInfo?.avatarUrl || otherUser?.avatar}
                            name={displayName}
                            size={40}
                            locked={conversationDisplayInfo?.locked}
                        />
                        <View style={styles.headerMeta}>
                            <Text style={styles.headerName} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text style={styles.headerStatus} numberOfLines={1}>
                                Không thể truy cập
                            </Text>
                        </View>
                    </View>
                    <View style={styles.headerActions} />
                </View>
                ) : null}

                {/* Nội dung lỗi giống web */}
                <View style={disbandedStyles.body}>
                    <View style={disbandedStyles.iconWrap}>
                        <Ionicons name="close" size={32} color="#EF4444" />
                    </View>
                    <Text style={disbandedStyles.title}>{errorTitle}</Text>
                    <Text style={disbandedStyles.subtitle}>
                        Hội thoại này hiện không khả dụng. Bạn có thể đã bị xóa khỏi
                        nhóm hoặc không có quyền xem nội dung này.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <ConversationSearchProvider
            conversationId={Number.isFinite(conversationId) ? conversationId : 0}
            jumpToMessage={requestJumpToMessage}
        >
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.header}>
                    <Pressable
                        style={styles.headerBackBtn}
                        onPress={handleBackPress}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color={colors.text}
                        />
                    </Pressable>

                    <View style={styles.headerIdentity}>
                        <UserAvatar
                            uri={
                                conversationDisplayInfo?.locked
                                    ? undefined
                                    : conversationDisplayInfo?.avatarUrl ||
                                      otherUser?.avatar
                            }
                            name={
                                conversationDisplayInfo?.name ||
                                otherUser?.nickname ||
                                otherUser?.username ||
                                "Conversation"
                            }
                            size={40}
                            locked={conversationDisplayInfo?.locked}
                            online={conversationDisplayInfo?.locked ? false : otherUserOnline}
                        />
                        <View style={styles.headerMeta}>
                            <Text style={styles.headerName} numberOfLines={1}>
                                {conversationDisplayInfo?.name ||
                                    otherUser?.nickname ||
                                    otherUser?.username ||
                                    "Conversation"}
                            </Text>
                            {headerStatusText ? (
                                <Text style={styles.headerStatus} numberOfLines={1}>
                                    {headerStatusText}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <Pressable
                            style={[
                                styles.headerActionBtn,
                                searchOpen && searchStyles.activeHeaderBtn,
                            ]}
                            hitSlop={8}
                            onPress={() => setSearchOpen((prev) => !prev)}
                        >
                            <Ionicons
                                name="search-outline"
                                size={22}
                                color={searchOpen ? "#2563EB" : colors.text}
                            />
                        </Pressable>
                        <Pressable
                            style={[
                                styles.headerActionBtn,
                                aiSheetOpen && searchStyles.activeHeaderBtn,
                            ]}
                            hitSlop={8}
                            onPress={openAIChat}
                            onPressIn={openAIChat}
                        >
                            <Ionicons
                                name="sparkles-outline"
                                size={22}
                                color={aiSheetOpen ? "#2563EB" : colors.text}
                            />
                        </Pressable>
                        <Pressable
                            style={styles.headerActionBtn}
                            hitSlop={8}
                            onPress={() => void tryStartCall("audio")}
                        >
                            <Ionicons
                                name="call-outline"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                        {rejoinableCall && !activeCall ? (
                            <Pressable
                                style={[
                                    styles.headerActionBtn,
                                    styles.rejoinCallBtn,
                                ]}
                                hitSlop={8}
                                onPress={() => {
                                    void rejoinActiveCall();
                                }}
                            >
                                <Ionicons
                                    name="enter-outline"
                                    size={22}
                                    color={colors.white}
                                />
                            </Pressable>
                        ) : null}
                        <Pressable
                            style={styles.headerActionBtn}
                            hitSlop={8}
                            onPress={() => void tryStartCall("video")}
                        >
                            <Ionicons
                                name="videocam-outline"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                        <Pressable
                            style={styles.headerActionBtn}
                            hitSlop={8}
                            onPress={() => router.push(`/messages/details/${conversationId}`)}
                        >
                            <Ionicons
                                name="information-circle-outline"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>
                </View>

                {searchOpen ? (
                    <ConversationSearchBar
                        members={Object.values(membersById)}
                        currentUserId={currentUserId}
                        onClose={() => setSearchOpen(false)}
                    />
                ) : null}

                {!isDirectChatBlocked &&
                (forceStrangerAfterBlock ||
                    (effectiveRelationshipInfo &&
                        effectiveRelationshipInfo.friendStatus !== "FRIEND")) ? (
                    <View style={styles.friendRequestBanner}>
                        <View style={styles.friendRequestTextWrap}>
                            <Ionicons
                                name="person-add-outline"
                                size={18}
                                color="#334155"
                            />
                            <Text
                                style={styles.friendRequestText}
                                numberOfLines={1}
                            >
                                {friendRequestReceived
                                    ? "Nguoi nay da gui loi moi ket ban cho ban"
                                    : "Gui yeu cau ket ban toi nguoi nay"}
                            </Text>
                        </View>
                        <Pressable
                            style={[
                                styles.friendRequestButton,
                                friendRequestSending &&
                                    styles.friendRequestButtonDisabled,
                            ]}
                            disabled={friendRequestSending}
                            onPress={() => void handleSendFriendRequest()}
                        >
                            <Text style={styles.friendRequestButtonText}>
                                {friendRequestReceived
                                    ? friendRequestSending
                                        ? "Dang chap nhan..."
                                        : "Chap nhan yeu cau"
                                    : friendRequestSent
                                    ? friendRequestSending
                                        ? "Dang huy..."
                                        : "Huy yeu cau"
                                    : friendRequestSending
                                      ? "Dang gui..."
                                      : "Gui ket ban"}
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                <PinnedBanner
                    pinnedBannerItems={pinnedBannerItems}
                    primaryPinnedItem={primaryPinnedItem}
                    showPinnedList={showPinnedList}
                    canExpandPinnedList={canExpandPinnedList}
                    setShowPinnedList={setShowPinnedList}
                    handleOpenPinnedMessage={handleOpenPinnedMessage}
                    handleUnpinMessage={handleUnpinMessage}
                />
                {jumpToast ? (
                    <View style={styles.jumpToastWrap} pointerEvents="none">
                        <Text style={styles.jumpToastText}>{jumpToast}</Text>
                    </View>
                ) : null}

                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    showsVerticalScrollIndicator={false}
                    onLayout={handleListLayout}
                    onScrollBeginDrag={handleListScrollBeginDrag}
                    onScroll={handleListScroll}
                    onContentSizeChange={handleContentSizeChange}
                    scrollEventThrottle={16}
                    onScrollToIndexFailed={handleScrollToIndexFailed}
                    renderItem={({ item, index }) => (
                        <MessageBubble
                            item={item}
                            index={index}
                            messages={messages}
                            currentUserId={currentUserId}
                            membersById={membersById}
                            conversation={conversation}
                            readReceipts={readReceipts}
                            pinRunMeta={systemRunMetaByIndex.get(index)}
                            highlightedMessageId={highlightedMessageId}
                            setMediaViewer={setMediaViewer}
                            handleMessageLongPress={handleMessageLongPress}
                            requestJumpToMessage={requestJumpToMessage}
                            handleExpandPinSystemRun={handleExpandPinSystemRun}
                            audioPlayback={{
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
                            }}
                            onRecallCall={(callType) => {
                                void tryStartCall(callType);
                            }}
                            isPinned={pinnedMessages.some((pin) => pin.messageId === item.id)}
                            onPinMessage={handlePinMessage}
                            onUnpinMessage={handleUnpinMessage}
                            onSwipeReply={replyToTargetMessage}
                        />
                    )}
                    ListFooterComponent={
                        <View>
                            {typingParticipantIds.length > 0 ? (
                                <View style={styles.typingIndicatorRow}>
                                    <View style={styles.typingAvatarRow}>
                                        {typingParticipantIds
                                            .slice(0, 3)
                                            .map((typingUserId) => {
                                                const typingMember =
                                                    membersById[typingUserId];

                                                return (
                                                    <UserAvatar
                                                        key={`typing-${typingUserId}`}
                                                        uri={
                                                            typingMember?.avatar
                                                        }
                                                        name={
                                                            typingMember?.nickname ||
                                                            typingMember?.username ||
                                                            "?"
                                                        }
                                                        size={24}
                                                    />
                                                );
                                            })}
                                    </View>

                                    <View style={styles.typingBubble}>
                                        <Animated.View
                                            style={[
                                                styles.typingDot,
                                                {
                                                    opacity:
                                                        typingDotAnimations[0].interpolate(
                                                            {
                                                                inputRange: [
                                                                    0, 1,
                                                                ],
                                                                outputRange: [
                                                                    0.35, 1,
                                                                ],
                                                            },
                                                        ),
                                                    transform: [
                                                        {
                                                            translateY:
                                                                typingDotAnimations[0].interpolate(
                                                                    {
                                                                        inputRange:
                                                                            [
                                                                                0,
                                                                                1,
                                                                            ],
                                                                        outputRange:
                                                                            [
                                                                                0,
                                                                                -2,
                                                                            ],
                                                                    },
                                                                ),
                                                        },
                                                    ],
                                                },
                                            ]}
                                        />
                                        <Animated.View
                                            style={[
                                                styles.typingDot,
                                                styles.typingDotOffsetOne,
                                                {
                                                    opacity:
                                                        typingDotAnimations[1].interpolate(
                                                            {
                                                                inputRange: [
                                                                    0, 1,
                                                                ],
                                                                outputRange: [
                                                                    0.35, 1,
                                                                ],
                                                            },
                                                        ),
                                                    transform: [
                                                        {
                                                            translateY:
                                                                typingDotAnimations[1].interpolate(
                                                                    {
                                                                        inputRange:
                                                                            [
                                                                                0,
                                                                                1,
                                                                            ],
                                                                        outputRange:
                                                                            [
                                                                                0,
                                                                                -2,
                                                                            ],
                                                                    },
                                                                ),
                                                        },
                                                    ],
                                                },
                                            ]}
                                        />
                                        <Animated.View
                                            style={[
                                                styles.typingDot,
                                                styles.typingDotOffsetTwo,
                                                {
                                                    opacity:
                                                        typingDotAnimations[2].interpolate(
                                                            {
                                                                inputRange: [
                                                                    0, 1,
                                                                ],
                                                                outputRange: [
                                                                    0.35, 1,
                                                                ],
                                                            },
                                                        ),
                                                    transform: [
                                                        {
                                                            translateY:
                                                                typingDotAnimations[2].interpolate(
                                                                    {
                                                                        inputRange:
                                                                            [
                                                                                0,
                                                                                1,
                                                                            ],
                                                                        outputRange:
                                                                            [
                                                                                0,
                                                                                -2,
                                                                            ],
                                                                    },
                                                                ),
                                                        },
                                                    ],
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            ) : null}

                            {loadingNewer ? (
                                <Text style={styles.loadingNewerText}>
                                    Dang tai tin nhan moi hon...
                                </Text>
                            ) : null}
                        </View>
                    }
                    ListHeaderComponent={
                        loadingMore ? (
                            <Text style={styles.loadingOlderText}>
                                Dang tai tin nhan cu...
                            </Text>
                        ) : null
                    }
                />

                {showRightScrollCue ? (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.rightScrollCue,
                            {
                                opacity: rightScrollCueOpacity,
                                top: rightScrollCueBaseTop,
                                transform: [
                                    {
                                        translateY: rightScrollCueTranslateY,
                                    },
                                ],
                            },
                        ]}
                    />
                ) : null}

                {showScrollToBottomButton ? (
                    <Pressable
                        style={[
                            styles.scrollToBottomFab,
                            {
                                bottom: Math.max(insets.bottom + 84, 92),
                            },
                        ]}
                        onPress={() => void handleScrollToBottomClick()}
                        accessibilityLabel={
                            isHistoricalMode
                                ? "Tro ve hien tai"
                                : "Cuon xuong tin nhan moi nhat"
                        }
                    >
                        <Ionicons name="arrow-down" size={18} color="#1F2937" />

                        {pendingNewMessages > 0 ? (
                            <View style={styles.scrollToBottomBadge}>
                                <Text style={styles.scrollToBottomBadgeText}>
                                    {pendingNewMessages > 99
                                        ? "99+"
                                        : pendingNewMessages}
                                </Text>
                            </View>
                        ) : null}
                    </Pressable>
                ) : null}

                {!searchOpen ? (
                    <MessageComposer
                        replyToMessage={replyToMessage}
                        setReplyToMessage={setReplyToMessage}
                        isRecordingVoice={isRecordingVoice}
                        onCancelRecording={onCancelRecording}
                        onStopRecordingAndSend={onStopRecordingAndSend}
                        onStartRecording={onStartRecording}
                        uploading={uploading}
                        sending={sending}
                        recordingSeconds={recordingSeconds}
                        messageInputRef={messageInputRef}
                        messageText={messageText}
                        setMessageText={setMessageText}
                        sendTypingSignal={sendTypingSignal}
                        inputSelection={inputSelection}
                        setInputSelection={setInputSelection}
                        onSend={onSend}
                        hasTypedText={hasTypedText}
                        emojiPickerOpen={emojiPickerOpen}
                        setEmojiPickerOpen={setEmojiPickerOpen}
                        onToggleEmojiPicker={onToggleEmojiPicker}
                        onCapturePhotoAndSend={onCapturePhotoAndSend}
                        onPickMediaAndSend={onPickMediaAndSend}
                        onPickDocumentAndSend={onPickDocumentAndSend}
                        onOpenAI={openAIChat}
                        loading={loading}
                        uploadProgressLabel={uploadProgressLabel || ""}
                        uploadProgressPercent={uploadProgressPercent}
                        uploadFailedFileNames={uploadFailedFileNames}
                        readOnlyNotice={
                            conversationDisplayInfo?.locked
                                ? LOCKED_ACCOUNT_NAME
                                : readOnlyNotice
                        }
                        readOnlyActionLabel={
                            isDirectBlockedByMe ? "Bỏ chặn" : null
                        }
                        onReadOnlyAction={
                            isDirectBlockedByMe
                                ? () => void handleUnblockDirectPartner()
                                : undefined
                        }
                        error={error}
                        onPickEmoji={onPickEmoji}
                    />
                ) : null}
            </KeyboardAvoidingView>

            <AIChatSheet
                open={aiSheetOpen}
                disabled={uploading || sending}
                summary={summary}
                suggestions={suggestions}
                error={aiError}
                isSummarizing={isSummarizing}
                isSuggesting={isSuggesting}
                onClose={() => setAiSheetOpen(false)}
                onSummarize={() => {
                    void summarizeConversation(currentMessagesForAISummary);
                }}
                onSuggest={() => {
                    void suggestReplies();
                }}
                onSuggestionClick={handleApplyAISuggestion}
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

            <Modal
                visible={Boolean(forwardSourceMessage)}
                transparent
                animationType="fade"
                onRequestClose={closeForwardModal}
            >
                <View style={forwardStyles.overlay}>
                    <View style={forwardStyles.card}>
                        <View style={forwardStyles.header}>
                            <View style={forwardStyles.headerTextWrap}>
                                <Text style={forwardStyles.title}>
                                    Chuyen tiep tin nhan
                                </Text>
                                <Text style={forwardStyles.subtitle} numberOfLines={1}>
                                    {forwardSourceMessage
                                        ? buildReplyPreview(forwardSourceMessage)
                                        : ""}
                                </Text>
                            </View>
                            <Pressable
                                style={forwardStyles.closeBtn}
                                onPress={closeForwardModal}
                            >
                                <Ionicons
                                    name="close"
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </Pressable>
                        </View>

                        {forwardLoading ? (
                            <View style={forwardStyles.loadingWrap}>
                                <ActivityIndicator color="#2563EB" />
                            </View>
                        ) : (
                            <FlatList
                                data={forwardConversations}
                                keyExtractor={(item) => String(item.id)}
                                style={forwardStyles.list}
                                contentContainerStyle={
                                    forwardConversations.length === 0
                                        ? forwardStyles.emptyList
                                        : undefined
                                }
                                ListEmptyComponent={
                                    <Text style={forwardStyles.emptyText}>
                                        Khong co hoi thoai phu hop
                                    </Text>
                                }
                                renderItem={({ item }) => {
                                    const selected = forwardSelectedIds.has(item.id);
                                    const displayInfo =
                                        buildConversationDisplayInfo({
                                            conversation: item,
                                            currentUserId,
                                        });
                                    return (
                                        <Pressable
                                            style={({ pressed }) => [
                                                forwardStyles.row,
                                                pressed && forwardStyles.rowPressed,
                                            ]}
                                            onPress={() =>
                                                toggleForwardTarget(item.id)
                                            }
                                        >
                                            {displayInfo.avatarUrl || item.imageUrl ? (
                                                <Image
                                                    source={{
                                                        uri:
                                                            displayInfo.avatarUrl ||
                                                            item.imageUrl,
                                                    }}
                                                    style={forwardStyles.avatar}
                                                />
                                            ) : (
                                                <View style={forwardStyles.avatarFallback}>
                                                    <Ionicons
                                                        name={
                                                            item.type === "GROUP"
                                                                ? "people"
                                                                : "person"
                                                        }
                                                        size={20}
                                                        color="#64748B"
                                                    />
                                                </View>
                                            )}
                                            <View style={forwardStyles.rowTextWrap}>
                                                <Text
                                                    style={forwardStyles.rowTitle}
                                                    numberOfLines={1}
                                                >
                                                    {displayInfo.name}
                                                </Text>
                                            </View>
                                            <View
                                                style={[
                                                    forwardStyles.checkCircle,
                                                    selected &&
                                                        forwardStyles.checkCircleSelected,
                                                ]}
                                            >
                                                {selected ? (
                                                    <Ionicons
                                                        name="checkmark"
                                                        size={14}
                                                        color={colors.white}
                                                    />
                                                ) : null}
                                            </View>
                                        </Pressable>
                                    );
                                }}
                            />
                        )}

                        {forwardError ? (
                            <Text style={forwardStyles.errorText}>
                                {forwardError}
                            </Text>
                        ) : null}

                        <View style={forwardStyles.footer}>
                            <Pressable
                                style={forwardStyles.cancelBtn}
                                onPress={closeForwardModal}
                                disabled={forwardSubmitting}
                            >
                                <Text style={forwardStyles.cancelText}>Huy</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    forwardStyles.submitBtn,
                                    (forwardSelectedIds.size === 0 ||
                                        forwardSubmitting) &&
                                        forwardStyles.submitBtnDisabled,
                                ]}
                                onPress={() => void submitForwardMessage()}
                                disabled={
                                    forwardSelectedIds.size === 0 ||
                                    forwardSubmitting
                                }
                            >
                                {forwardSubmitting ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <Text style={forwardStyles.submitText}>
                                        Chuyen tiep
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <MessageContextMenu
                contextMenu={contextMenu}
                selectedMessage={
                    contextMenu
                        ? messages.find(
                            (message) => message.id === contextMenu.messageId,
                        )
                        : null
                }
                closeContextMenu={closeContextMenu}
                handleContextAction={handleContextAction}
                onReaction={addReaction}
                selectedMessagePinned={selectedMessagePinned}
                canRecallOwnMessages={canRecallOwnMessages}
            />
            <MediaViewerModal
                mediaViewer={mediaViewer}
                closeMediaViewer={closeMediaViewer}
                onForwardImage={forwardViewerImage}
            />

            <SelectGroupMembersModal
                open={isAddMembersModalOpen}
                friends={availableFriends}
                existingMemberIds={groupMemberIds}
                loadingFriends={friendsLoading}
                friendsError={friendsError}
                submitting={isAddingMembers}
                error={actionError}
                onClose={closeAddMembersModal}
                onSubmit={addMembersToGroup}
              />
            <IncomingCallOverlay
                visible={Boolean(incomingCall)}
                callerName={incomingCallerName}
                callType={incomingCall?.callType ?? "audio"}
                onAccept={() => void acceptIncomingCall()}
                onReject={rejectIncomingCall}
            />
            <InCallOverlay
                visible={Boolean(activeCall)}
                callType={activeCall?.callType ?? "audio"}
                remoteName={activeCall?.remoteName || incomingCallerName}
                remoteAvatar={activeCall?.remoteAvatar || otherUser?.avatar}
                status={callStatus ?? "calling"}
                durationText={callDurationText}
                localStreamUrl={localStreamUrl}
                localUserId={currentUserId}
                remoteStreamUrl={remoteStreamUrl}
                remoteStreamUrls={remoteStreamUrls}
                participants={callParticipants}
                micEnabled={micEnabled}
                cameraEnabled={cameraEnabled}
                speakerEnabled={speakerEnabled}
                onToggleMic={toggleMic}
                onToggleCamera={toggleCamera}
                onSwitchCamera={switchCamera}
                onToggleSpeaker={toggleSpeaker}
                onInviteParticipants={
                    conversation?.type === "GROUP" && hasInviteCallCandidates
                        ? () => openCallPicker("invite", activeCall?.callType ?? "audio")
                        : undefined
                }
                onEndCall={() => void endCall()}
            />
            <Modal transparent animationType="fade" visible={callPickerVisible}>
                <View style={localCallPickerStyles.backdrop}>
                    <View style={localCallPickerStyles.card}>
                        <View style={localCallPickerStyles.header}>
                            <View>
                                <Text style={localCallPickerStyles.title}>
                                    {callPickerMode === "invite"
                                        ? "Moi them nguoi"
                                        : "Chon nguoi de goi"}
                                </Text>
                                <Text style={localCallPickerStyles.subtitle}>
                                    Da chon {selectedCallMemberIds.size}/{callPickerLimit}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setCallPickerVisible(false)}
                                style={localCallPickerStyles.closeBtn}
                            >
                                <Ionicons name="close" size={20} color="#374151" />
                            </Pressable>
                        </View>

                        <FlatList
                            data={callPickerMembers}
                            keyExtractor={(item) => String(item.userId)}
                            style={localCallPickerStyles.list}
                            ListEmptyComponent={
                                <Text style={localCallPickerStyles.emptyText}>
                                    Khong con thanh vien phu hop de goi.
                                </Text>
                            }
                            renderItem={({ item }) => {
                                const checked = selectedCallMemberIds.has(item.userId);
                                const disabled =
                                    !checked && selectedCallMemberIds.size >= callPickerLimit;
                                return (
                                    <Pressable
                                        onPress={() => toggleCallMember(item.userId)}
                                        disabled={disabled}
                                        style={[
                                            localCallPickerStyles.memberRow,
                                            checked && localCallPickerStyles.memberRowSelected,
                                            disabled && localCallPickerStyles.memberRowDisabled,
                                        ]}
                                    >
                                        <Image
                                            source={{
                                                uri:
                                                    item.avatar ||
                                                    "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                                            }}
                                            style={localCallPickerStyles.memberAvatar}
                                        />
                                        <View style={localCallPickerStyles.memberMeta}>
                                            <Text
                                                style={localCallPickerStyles.memberName}
                                                numberOfLines={1}
                                            >
                                                {item.nickname || item.username || "Thanh vien"}
                                            </Text>
                                            {item.username ? (
                                                <Text
                                                    style={localCallPickerStyles.memberUsername}
                                                    numberOfLines={1}
                                                >
                                                    @{item.username}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <Ionicons
                                            name={checked ? "checkmark-circle" : "ellipse-outline"}
                                            size={22}
                                            color={checked ? "#2563EB" : "#9CA3AF"}
                                        />
                                    </Pressable>
                                );
                            }}
                        />

                        <View style={localCallPickerStyles.actions}>
                            <Pressable
                                onPress={() => setCallPickerVisible(false)}
                                style={localCallPickerStyles.secondaryBtn}
                            >
                                <Text style={localCallPickerStyles.secondaryText}>Huy</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => void submitCallPicker()}
                                disabled={selectedCallMemberIds.size === 0}
                                style={[
                                    localCallPickerStyles.primaryBtn,
                                    selectedCallMemberIds.size === 0 &&
                                        localCallPickerStyles.primaryBtnDisabled,
                                ]}
                            >
                                <Text style={localCallPickerStyles.primaryText}>
                                    {callPickerMode === "invite" ? "Moi" : "Goi"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
        </ConversationSearchProvider>
    );
}

const localCallPickerStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(2, 6, 23, 0.45)",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
    },
    card: {
        width: "100%",
        maxHeight: "78%",
        borderRadius: 18,
        backgroundColor: colors.white,
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E7EB",
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111827",
    },
    subtitle: {
        marginTop: 2,
        fontSize: 12,
        color: "#6B7280",
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    list: {
        maxHeight: 360,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    emptyText: {
        paddingVertical: 28,
        textAlign: "center",
        color: "#6B7280",
        fontSize: 14,
    },
    memberRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 12,
    },
    memberRowSelected: {
        backgroundColor: "#EFF6FF",
    },
    memberRowDisabled: {
        opacity: 0.45,
    },
    memberAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    memberMeta: {
        flex: 1,
        minWidth: 0,
    },
    memberName: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
    },
    memberUsername: {
        marginTop: 2,
        fontSize: 12,
        color: "#6B7280",
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
        padding: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E7EB",
    },
    secondaryBtn: {
        paddingHorizontal: 16,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    secondaryText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#374151",
    },
    primaryBtn: {
        paddingHorizontal: 18,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
    },
    primaryBtnDisabled: {
        opacity: 0.55,
    },
    primaryText: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.white,
    },
});

const searchStyles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E7EB",
        backgroundColor: "#F8FAFC",
    },
    inputWrap: {
        flex: 1,
        minWidth: 0,
        height: 38,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#CBD5E1",
        backgroundColor: colors.white,
        paddingHorizontal: 10,
    },
    input: {
        flex: 1,
        minWidth: 0,
        color: colors.text,
        fontSize: 14,
        paddingVertical: 0,
    },
    status: {
        width: 62,
        textAlign: "center",
        color: "#64748B",
        fontSize: 12,
        fontWeight: "600",
    },
    senderBtn: {
        maxWidth: 90,
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 9,
        paddingHorizontal: 8,
        backgroundColor: colors.white,
    },
    senderBtnText: {
        flexShrink: 1,
        color: "#334155",
        fontSize: 12,
        fontWeight: "700",
    },
    senderMenu: {
        position: "absolute",
        top: 50,
        right: 10,
        zIndex: 30,
        width: 240,
        maxHeight: 310,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#E5E7EB",
        backgroundColor: colors.white,
        padding: 8,
        shadowColor: "#000",
        shadowOpacity: 0.16,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    senderSearchWrap: {
        height: 36,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 10,
        marginBottom: 6,
    },
    senderSearchInput: {
        flex: 1,
        minWidth: 0,
        color: colors.text,
        fontSize: 13,
        paddingVertical: 0,
    },
    senderOption: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 10,
        paddingHorizontal: 8,
    },
    senderOptionText: {
        flex: 1,
        minWidth: 0,
        color: colors.text,
        fontSize: 14,
        fontWeight: "600",
    },
    allAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#DBEAFE",
    },
    allAvatarText: {
        color: "#1D4ED8",
        fontSize: 10,
        fontWeight: "800",
    },
    dateRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    dateInputWrap: {
        flex: 1,
        minWidth: 130,
        height: 36,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 10,
        backgroundColor: colors.white,
        paddingHorizontal: 10,
    },
    dateInput: {
        flex: 1,
        minWidth: 0,
        color: colors.text,
        fontSize: 13,
    },
    datePlaceholder: {
        color: "#94A3B8",
    },
    clearDateBtn: {
        height: 36,
        justifyContent: "center",
        borderRadius: 10,
        paddingHorizontal: 10,
        backgroundColor: "#DBEAFE",
    },
    clearDateText: {
        color: "#1D4ED8",
        fontSize: 12,
        fontWeight: "800",
    },
    dateError: {
        width: "100%",
        color: "#DC2626",
        fontSize: 12,
        fontWeight: "700",
    },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.white,
    },
    iconBtnDisabled: {
        opacity: 0.35,
    },
    activeHeaderBtn: {
        backgroundColor: "#DBEAFE",
    },
});

const disbandedStyles = StyleSheet.create({
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        backgroundColor: "#F9FAFB",
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#FEF2F2",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 13,
        color: "#6B7280",
        textAlign: "center",
        lineHeight: 20,
    },
});

const forwardStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.42)",
        justifyContent: "center",
        paddingHorizontal: 18,
    },
    card: {
        maxHeight: "78%",
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: colors.white,
    },
    header: {
        minHeight: 64,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#EEF0F3",
        flexDirection: "row",
        alignItems: "center",
    },
    headerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 16,
        fontWeight: "800",
        color: colors.text,
    },
    subtitle: {
        marginTop: 3,
        fontSize: 12,
        color: colors.textMuted,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
        marginLeft: 10,
    },
    loadingWrap: {
        height: 220,
        alignItems: "center",
        justifyContent: "center",
    },
    list: {
        maxHeight: 360,
    },
    emptyList: {
        minHeight: 160,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 13,
    },
    row: {
        minHeight: 62,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    rowPressed: {
        backgroundColor: "#F8FAFC",
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#E5E7EB",
    },
    avatarFallback: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E5E7EB",
    },
    rowTextWrap: {
        flex: 1,
        minWidth: 0,
        marginLeft: 11,
    },
    rowTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    rowSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    checkCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 10,
    },
    checkCircleSelected: {
        borderColor: "#2563EB",
        backgroundColor: "#2563EB",
    },
    errorText: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: "#EEF0F3",
        color: "#EF4444",
        fontSize: 13,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#EEF0F3",
    },
    cancelBtn: {
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    cancelText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#374151",
    },
    submitBtn: {
        minWidth: 112,
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
    },
    submitBtnDisabled: {
        opacity: 0.55,
    },
    submitText: {
        fontSize: 14,
        fontWeight: "800",
        color: colors.white,
    },
});
