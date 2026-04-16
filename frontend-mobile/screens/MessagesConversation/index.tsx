import { styles } from "./styles";
import { MessageComposer } from "@/components/MessageComposer";
import { MessageBubble } from "@/components/MessageBubble";
import { useMessageAudioPlayback } from "@/hooks/useMessageAudioPlayback";
import { useMessageComposerMediaActions } from "@/hooks/useMessageComposerMediaActions";
import { MediaViewerModal } from "@/components/MediaViewerModal";
import { MessageContextMenu } from "@/components/MessageContextMenu";
import { UserAvatar } from "@/components";
import { colors, spacing } from "@/constants";
import { useChatWindowController } from "@/hooks/useChatWindowController";
import type { LocalUploadFile, Message } from "@/types/chat";
import { formatRelativeTime } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Audio, type AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
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
    PinnedBannerItem,
    PinSystemRunRenderMeta,
    contextActions,
    formatDurationMillis,
    formatFileSize,
    resolveMediaUrl,
    isLikelyStoragePathOrUrl,
    resolveAttachmentUrls,
    formatMessageTime,
    isEmojiOnlyText,
    formatReplyLabel,
    getFileBadgeLabel,
    resolvePinSystemPreview,
    parseCallMeta,
    isPinSystemMessageType,
    buildReplyPreview,
    normalizeSearchText,
    inferReplyPreviewType,
    buildAudioWaveBars,
} from "@/utils/messageUtils";
import { PinnedBanner } from "@/components/PinnedBanner";
export default function MessagesConversationScreen() {
    const { conversationId: conversationIdParam } = useLocalSearchParams<{
        conversationId?: string;
    }>();
    const conversationId = Number(conversationIdParam ?? 0);
    const router = useRouter();
    const insets = useSafeAreaInsets();

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
        hasMoreOlder,
        hasMoreNewer,
        isHistoricalMode,
        sending,
        uploading,
        uploadProgressPercent,
        uploadProgressLabel,
        uploadFailedFileNames,
        error,
        handleSend,
        handleSendMixedMedia,
        handleRecall,
        handleDeleteForMe,
        handlePinMessage,
        handleUnpinMessage,
        sendTypingSignal,
        loadOlderMessages,
        loadNewerMessages,
        handleJumpToMessage,
        resetToPresent,
    } = useChatWindowController({
        conversationId: Number.isFinite(conversationId) ? conversationId : 0,
    });

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

    const listRef = useRef<FlatList<Message>>(null);
    const messageInputRef = useRef<TextInput>(null);
    const latestMessageIdRef = useRef("");
    const isAtBottomRef = useRef(true);
    const stickToBottomRef = useRef(true);
    const didInitialAutoScrollRef = useRef(false);
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

    const activityText = useMemo(() => {
        if (!conversation?.updatedAt) return "Dang hoat dong";
        return `Hoat dong ${formatRelativeTime(conversation.updatedAt)} truoc`;
    }, [conversation?.updatedAt]);

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
                            animated: true,
                            viewPosition: 0.5,
                        });
                    } catch {
                        const fallbackOffset = Math.max(index * 92 - 140, 0);
                        listRef.current?.scrollToOffset({
                            offset: fallbackOffset,
                            animated: true,
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

    const pinnedBannerItems = useMemo<PinnedBannerItem[]>(() => {
        const previewText = (message: Message) => {
            if (message.isRecalled) return "Tin nhan da duoc thu hoi";
            if (message.type === "IMAGE") return "[Hinh anh]";
            if (message.type === "VIDEO") return "[Video]";
            if (message.type === "AUDIO") return "[Tin nhan thoai]";
            if (message.type === "FILE") return "[Tep dinh kem]";
            if (message.type === "CALL") return "[Cuoc goi]";
            return message.content?.trim() || "Tin nhan";
        };

        return pinnedMessages.slice(0, 3).map((pin) => {
            const matchedMessage = messages.find(
                (message) => message.id === pin.messageId,
            );
            const sender = matchedMessage
                ? membersById[matchedMessage.senderId]
                : undefined;

            const senderName =
                sender?.nickname || sender?.username || "Nguoi dung";
            const thumbUrl =
                matchedMessage?.type === "IMAGE"
                    ? resolveAttachmentUrls(matchedMessage)[0]
                    : undefined;

            return {
                messageId: pin.messageId,
                pinnedAt: pin.pinnedAt,
                senderName,
                preview: matchedMessage
                    ? previewText(matchedMessage)
                    : "Tin nhan da ghim",
                thumbUrl,
            };
        });
    }, [membersById, messages, pinnedMessages]);

    const primaryPinnedItem = pinnedBannerItems[0];
    const canExpandPinnedList = pinnedBannerItems.length > 1;

    const pinSystemRunMetaByIndex = useMemo(() => {
        const meta = new Map<number, PinSystemRunRenderMeta>();

        for (let cursor = 0; cursor < messages.length; ) {
            const current = messages[cursor];
            if (!isPinSystemMessageType(current.type)) {
                cursor += 1;
                continue;
            }

            const runStart = cursor;
            while (
                cursor < messages.length &&
                isPinSystemMessageType(messages[cursor].type)
            ) {
                cursor += 1;
            }

            const runEnd = cursor - 1;
            const runLength = runEnd - runStart + 1;
            const runKey = messages[runStart]?.id || `pin-run-${runStart}`;

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

    const {
        onPickMediaAndSend,
        onCapturePhotoAndSend,
        onCaptureVideoAndSend,
        onPickDocumentAndSend,
    } = useMessageComposerMediaActions({
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

    const closeContextMenu = () => setContextMenu(null);

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

        setContextMenu({ messageId, top, left });
    };

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
                const senderName =
                    membersById[targetMessage.senderId]?.nickname ||
                    membersById[targetMessage.senderId]?.username ||
                    "Nguoi dung";

                setReplyToMessage({
                    id: targetMessage.id,
                    senderName,
                    content: buildReplyPreview(targetMessage),
                });
            }
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

        if (event.nativeEvent.contentOffset.y <= LOAD_OLDER_TRIGGER_PX) {
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
            animated: true,
        });

        setTimeout(() => {
            listRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
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

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.header}>
                    <Pressable
                        style={styles.headerBackBtn}
                        onPress={() => router.back()}
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
                            uri={otherUser?.avatar}
                            name={otherUser?.username ?? "?"}
                            size={40}
                        />
                        <View style={styles.headerMeta}>
                            <Text style={styles.headerName} numberOfLines={1}>
                                {otherUser?.nickname ??
                                    otherUser?.username ??
                                    "Conversation"}
                            </Text>
                            <Text style={styles.headerStatus} numberOfLines={1}>
                                {activityText}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <Pressable style={styles.headerActionBtn} hitSlop={8}>
                            <Ionicons
                                name="sparkles-outline"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                        <Pressable style={styles.headerActionBtn} hitSlop={8}>
                            <Ionicons
                                name="call-outline"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                        <Pressable style={styles.headerActionBtn} hitSlop={8}>
                            <Ionicons
                                name="videocam-outline"
                                size={22}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>
                </View>

                <PinnedBanner
                    pinnedBannerItems={pinnedBannerItems}
                    primaryPinnedItem={primaryPinnedItem}
                    showPinnedList={showPinnedList}
                    canExpandPinnedList={canExpandPinnedList}
                    setShowPinnedList={setShowPinnedList}
                    handleOpenPinnedMessage={handleOpenPinnedMessage}
                    handleUnpinMessage={handleUnpinMessage}
                />

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
                            pinRunMeta={pinSystemRunMetaByIndex.get(index)}
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
                    onCaptureVideoAndSend={onCaptureVideoAndSend}
                    onPickMediaAndSend={onPickMediaAndSend}
                    onPickDocumentAndSend={onPickDocumentAndSend}
                    loading={loading}
                    uploadProgressLabel={uploadProgressLabel || ""}
                    uploadProgressPercent={uploadProgressPercent}
                    uploadFailedFileNames={uploadFailedFileNames}
                    error={error}
                    onPickEmoji={onPickEmoji}
                />
            </KeyboardAvoidingView>

            <MessageContextMenu
                contextMenu={contextMenu}
                closeContextMenu={closeContextMenu}
                handleContextAction={handleContextAction}
                selectedMessagePinned={selectedMessagePinned}
            />
            <MediaViewerModal
                mediaViewer={mediaViewer}
                closeMediaViewer={closeMediaViewer}
            />
        </SafeAreaView>
    );
}
