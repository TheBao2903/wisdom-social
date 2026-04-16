import React from "react";
import { View, Text, Image, Pressable, Animated, StyleSheet, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { UserAvatar } from "@/components";
import { colors, spacing } from "@/constants";
const RIGHT_SCROLL_CUE_HEIGHT = 38;
import { Message, Conversation, ConversationMember, PinnedMessageDetail } from "@/types/chat";
import { MembersByUserId } from "@/stores/chatRuntimeStore";
import { 
    isPinSystemMessageType, 
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
    formatReplyLabel
} from "@/utils/messageUtils";

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
    handleMessageLongPress: (event: any, messageId: string, mine: boolean) => void;
    requestJumpToMessage: (messageId: string) => Promise<void>;
    handleExpandPinSystemRun: (runKey: string) => void;
    audioPlayback: any;
};

export const MessageBubble = React.memo(({
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
    audioPlayback
}: MessageBubbleProps) => {

    const { 
        audioLoadingKey, playingAudioKey, activePressAudioKey, activeSeekAudioKey, 
        audioProgressMap, toggleAudioPlayback, handleAudioPressIn, handleAudioPressOut, 
        handleSeekInteractionStart, seekAudioByLocation, handleSeekInteractionEnd, 
        getAudioWaveBars, combinedAudioIconScale, setAudioTrackWidthMap, audioSeekScale, 
        audioPlayPulse, audioPressScale, audioIconFade 
    } = audioPlayback;
    
                        const mine = item.senderId === currentUserId;
                        const sender = membersById[item.senderId];
                        const senderDisplayName =
                            sender?.nickname ||
                            sender?.username ||
                            "Nguoi dung";

                        let previousMessage: Message | undefined;
                        for (let cursor = index - 1; cursor >= 0; cursor--) {
                            const candidate = messages[cursor];
                            if (isPinSystemMessageType(candidate.type)) {
                                continue;
                            }
                            previousMessage = candidate;
                            break;
                        }

                        let nextMessage: Message | undefined;
                        for (
                            let cursor = index + 1;
                            cursor < messages.length;
                            cursor++
                        ) {
                            const candidate = messages[cursor];
                            if (isPinSystemMessageType(candidate.type)) {
                                continue;
                            }
                            nextMessage = candidate;
                            break;
                        }
                        const isFirstInGroup =
                            !previousMessage ||
                            previousMessage.senderId !== item.senderId;
                        const isLastInGroup =
                            !nextMessage ||
                            nextMessage.senderId !== item.senderId;
                        const isConsecutiveRecalledInGroup =
                            !isFirstInGroup &&
                            item.isRecalled &&
                            Boolean(previousMessage?.isRecalled) &&
                            previousMessage?.senderId === item.senderId;
                        const showSenderLabel =
                            !mine &&
                            conversation?.type === "GROUP" &&
                            isFirstInGroup &&
                            !item.isRecalled;
                        const showAvatar = !mine && isLastInGroup;
                        const messageTime = formatMessageTime(item.createdAt);
                        const receiptsForThisMessage =
                            mine && !item.isRecalled
                                ? readReceipts.filter(
                                      (receipt) =>
                                          receipt.lastMessageId === item.id &&
                                          receipt.userId !== currentUserId,
                                  )
                                : [];

                        const imageUrls =
                            item.type === "IMAGE"
                                ? resolveAttachmentUrls(item)
                                : [];
                        const videoUrls =
                            item.type === "VIDEO"
                                ? resolveAttachmentUrls(item)
                                : [];
                        const audioUrls =
                            item.type === "AUDIO"
                                ? resolveAttachmentUrls(item)
                                : [];
                        const callMeta = parseCallMeta(item);

                        const rawFileAttachments =
                            item.type === "FILE"
                                ? Array.isArray(item.attachments) &&
                                  item.attachments.length > 0
                                    ? item.attachments
                                    : isLikelyStoragePathOrUrl(item.content)
                                      ? [
                                            {
                                                url: item.content ?? "",
                                                fileName:
                                                    (item.content ?? "")
                                                        .split("/")
                                                        .pop() ||
                                                    "Tep dinh kem",
                                            },
                                        ]
                                      : []
                                : [];

                        const fileAttachments = rawFileAttachments.map(
                            (attachment) => ({
                                ...attachment,
                                resolvedUrl:
                                    resolveMediaUrl(attachment.url) ||
                                    attachment.url,
                            }),
                        );

                        const replySenderName =
                            typeof item.replyInfo?.senderId === "number"
                                ? membersById[item.replyInfo.senderId]
                                      ?.nickname ||
                                  membersById[item.replyInfo.senderId]
                                      ?.username ||
                                  "Nguoi dung"
                                : "Nguoi dung";

                        const replyPreviewType = inferReplyPreviewType(
                            item.replyInfo,
                        );
                        const replyPreviewContent =
                            item.replyInfo?.content?.trim() ?? "";
                        const normalizedReplyPreviewContent =
                            normalizeSearchText(replyPreviewContent);
                        const isReplyPreviewRecalled =
                            normalizedReplyPreviewContent.includes("thu hoi") ||
                            normalizedReplyPreviewContent.includes(
                                "da bi go bo",
                            ) ||
                            normalizedReplyPreviewContent.includes(
                                "da duoc go bo",
                            );
                        const isReplyMedia = replyPreviewType === "IMAGE" || replyPreviewType === "VIDEO";
                        const replyPreviewImageUrl =
                            isReplyMedia && isLikelyStoragePathOrUrl(replyPreviewContent)
                                ? resolveMediaUrl(replyPreviewContent)
                                : "";
                        const isFullMediaReply = !!replyPreviewImageUrl && !isReplyPreviewRecalled;
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
                            item.type !== "CALL" &&
                            item.type !== "SYSTEM_PIN" &&
                            item.type !== "SYSTEM_UPIN";

                        const shouldShowAttachmentCaption =
                            !item.isRecalled &&
                            (item.type === "IMAGE" ||
                                item.type === "FILE" ||
                                item.type === "VIDEO" ||
                                item.type === "AUDIO") &&
                            trimmedContent.length > 0 &&
                            !isLikelyStoragePathOrUrl(trimmedContent);

                        const isRichCardMessage =
                            !item.isRecalled &&
                            (item.type === "IMAGE" ||
                                item.type === "FILE" ||
                                item.type === "VIDEO" ||
                                item.type === "AUDIO" ||
                                item.type === "CALL");
                        const hasReplyPreview =
                            Boolean(item.replyInfo) && !item.isRecalled;
                        const shouldOverlayReplyWithBubble =
                            hasReplyPreview && !isRichCardMessage;
                        const replySenderId = item.replyInfo?.senderId;
                        const replyMessageId = item.replyInfo?.messageId ?? "";

                        const bubbleGroupShape = !isRichCardMessage
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

                        const isPinSystemMessage = isPinSystemMessageType(
                            item.type,
                        );

                        if (isPinSystemMessage) {
                            if (pinRunMeta?.shouldHideMessage) {
                                return null;
                            }

                            if (pinRunMeta?.shouldRenderCollapsedButton) {
                                return (
                                    <View style={styles.systemMessageRow}>
                                        <Pressable
                                            style={styles.systemCollapsedBtn}
                                            onPress={() =>
                                                handleExpandPinSystemRun(
                                                    pinRunMeta.runKey,
                                                )
                                            }
                                        >
                                            <Ionicons
                                                name="pin-outline"
                                                size={13}
                                                color="#57585aff"
                                            />
                                            <Text
                                                style={
                                                    styles.systemCollapsedBtnText
                                                }
                                            >
                                                {`Xem cap nhat truoc (${pinRunMeta.runLength})`}
                                            </Text>
                                        </Pressable>
                                    </View>
                                );
                            }

                            const actorLabel = mine ? "Ban" : senderDisplayName;
                            const actionLabel =
                                item.type === "SYSTEM_UPIN"
                                    ? ""
                                    : "ghim";

                            return (
                                <View style={styles.systemMessageRow}>
                                    <View style={styles.systemMessageBadge}>
                                        <Ionicons
                                            name="pin-outline"
                                            size={12}
                                            color="#4B5563"
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

                        return (
                            <View style={styles.messageItemWrap}>
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
                                        mine ? styles.rowMine : styles.rowOther,
                                    ]}
                                >
                                    {!mine ? (
                                        showAvatar ? (
                                            <UserAvatar
                                                uri={sender?.avatar}
                                                name={sender?.username ?? "?"}
                                                size={30}
                                            />
                                        ) : (
                                            <View style={styles.avatarSpacer} />
                                        )
                                    ) : null}

                                    <View
                                        style={[
                                            styles.messageColumn,
                                            mine
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
                                                    mine &&
                                                        styles.replyRelationRowMine,
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
                                                        mine &&
                                                            styles.replyRelationLabelMine,
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {formatReplyLabel({
                                                        currentUserId,
                                                        messageSenderId:
                                                            item.senderId,
                                                        messageSenderName:
                                                            senderDisplayName,
                                                        replySenderId,
                                                        replySenderName,
                                                    })}
                                                </Text>
                                            </View>
                                        ) : null}

                                        <Pressable
                                            delayLongPress={500}
                                            onLongPress={(event) =>
                                                handleMessageLongPress(
                                                    event,
                                                    item.id,
                                                    mine,
                                                )
                                            }
                                        >
                                            {messageIsEmojiOnly ? (
                                                <Text
                                                    style={styles.emojiOnlyText}
                                                >
                                                    {trimmedContent}
                                                </Text>
                                            ) : (
                                                <>
                                                    {hasReplyPreview ? (
                                                        <Pressable
                                                            style={[
                                                                isFullMediaReply ? styles.replyPreviewFullWrap : styles.replyPreview,
                                                                styles.replyPreviewOverlay,
                                                                mine && (isFullMediaReply ? styles.replyPreviewFullWrapMine : styles.replyPreviewMine),
                                                                mine
                                                                    ? styles.replyPreviewConnectedMine
                                                                    : styles.replyPreviewConnectedOther,
                                                            ]}
                                                            onPress={() => {
                                                                if (
                                                                    !replyMessageId
                                                                )
                                                                    return;
                                                                void requestJumpToMessage(
                                                                    replyMessageId,
                                                                );
                                                            }}
                                                        >
                                                            {isFullMediaReply ? (
                                                                <View style={styles.replyPreviewFullBody}>
                                                                    {replyPreviewType === "VIDEO" ? (
                                                                        <>
                                                                            <Video
                                                                                source={{ uri: replyPreviewImageUrl }}
                                                                                style={styles.replyPreviewFullImage}
                                                                                resizeMode={ResizeMode.COVER}
                                                                                shouldPlay={false}
                                                                                positionMillis={0}
                                                                                useNativeControls={false}
                                                                            />
                                                                            <View style={styles.replyPreviewFullVideoOverlay}>
                                                                                <Ionicons name="play" size={20} color="#FFF" />
                                                                            </View>
                                                                        </>
                                                                    ) : (
                                                                        <Image
                                                                            source={{ uri: replyPreviewImageUrl }}
                                                                            style={styles.replyPreviewFullImage}
                                                                        />
                                                                    )}
                                                                </View>
                                                            ) : (
                                                                <View style={styles.replyPreviewBody}>
                                                                    {replyPreviewType === "IMAGE" && !isReplyPreviewRecalled ? (
                                                                        <View style={[styles.replyPreviewIconBox, mine && styles.replyPreviewIconBoxMine]}>
                                                                            <Ionicons name="image-outline" size={20} color="#4B5563" />
                                                                        </View>
                                                                    ) : replyPreviewType === "VIDEO" && !isReplyPreviewRecalled ? (
                                                                        <View style={[styles.replyPreviewIconBox, mine && styles.replyPreviewIconBoxMine]}>
                                                                            <Ionicons name="videocam-outline" size={20} color="#4B5563" />
                                                                        </View>
                                                                    ) : replyPreviewType === "AUDIO" && !isReplyPreviewRecalled ? (
                                                                        <View style={[styles.replyPreviewIconBox, mine && styles.replyPreviewIconBoxMine]}>
                                                                            <Ionicons name="mic-outline" size={18} color="#4B5563" />
                                                                        </View>
                                                                    ) : replyPreviewType === "CALL" && !isReplyPreviewRecalled ? (
                                                                        <View style={[styles.replyPreviewIconBox, mine && styles.replyPreviewIconBoxMine]}>
                                                                            <Ionicons name="call-outline" size={17} color="#4B5563" />
                                                                        </View>
                                                                    ) : null}

                                                                    {replyPreviewText ? (
                                                                        <View style={[styles.replyPreviewTextWrap, !hasReplyLeadingVisual && styles.replyPreviewTextWrapNoLead]}>
                                                                            {replyPreviewType === "FILE" && !isReplyPreviewRecalled ? (
                                                                                <View style={styles.replyFileInline}>
                                                                                    <Text numberOfLines={1} style={[styles.replyContentOnly, mine && styles.replyContentOnlyMine]}>
                                                                                        {replyPreviewText}
                                                                                    </Text>
                                                                                    <Ionicons name="attach-outline" size={13} color="#6B7280" />
                                                                                </View>
                                                                            ) : (
                                                                                <Text numberOfLines={1} style={[styles.replyContentOnly, mine && styles.replyContentOnlyMine]}>
                                                                                    {replyPreviewText}
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
                                                            highlightedMessageId ===
                                                                item.id &&
                                                                styles.highlightedBubble,
                                                            item.isRecalled
                                                                ? styles.bubbleRecalled
                                                                : isRichCardMessage
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
                                                                !isRichCardMessage &&
                                                                styles.cardShadow,
                                                        ]}
                                                    >
                                                        <View
                                                            style={
                                                                styles.bubbleMainContent
                                                            }
                                                        >
                                                            {item.isRecalled ? (
                                                                <Text
                                                                    style={[
                                                                        styles.messageText,
                                                                        mine &&
                                                                            styles.messageTextMine,
                                                                        styles.recalledText,
                                                                    ]}
                                                                >
                                                                    Tin nhan da
                                                                    duoc thu hoi
                                                                </Text>
                                                            ) : null}

                                                            {imageUrls.length >
                                                            0 ? (
                                                                <View
                                                                    style={
                                                                        styles.imageGrid
                                                                    }
                                                                >
                                                                    {imageUrls.map(
                                                                        (
                                                                            url,
                                                                            imageIndex,
                                                                        ) => (
                                                                            <Pressable
                                                                                key={`${item.id}-image-${imageIndex}`}
                                                                                onPress={() =>
                                                                                    setMediaViewer(
                                                                                        {
                                                                                            type: "IMAGE",
                                                                                            url,
                                                                                        },
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
                                                                            </Pressable>
                                                                        ),
                                                                    )}
                                                                </View>
                                                            ) : null}

                                                            {videoUrls.length >
                                                            0 ? (
                                                                <View
                                                                    style={
                                                                        styles.videoList
                                                                    }
                                                                >
                                                                    {videoUrls.map(
                                                                        (
                                                                            url,
                                                                            videoIndex,
                                                                        ) => (
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
                                                                                    onPress={() =>
                                                                                        setMediaViewer(
                                                                                            {
                                                                                                type: "VIDEO",
                                                                                                url,
                                                                                            },
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

                                                            {audioUrls.length >
                                                            0 ? (
                                                                <View
                                                                    style={
                                                                        styles.audioList
                                                                    }
                                                                >
                                                                    {audioUrls.map(
                                                                        (
                                                                            url,
                                                                            audioIndex,
                                                                        ) => {
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
                                                                                        onPress={() =>
                                                                                            void toggleAudioPlayback(
                                                                                                audioKey,
                                                                                                url,
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
                                                                                        <View
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
                                                                                                setAudioTrackWidthMap((prev: Record<string, number>) => {
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
                                                                                                handleSeekInteractionStart(
                                                                                                    audioKey,
                                                                                                );
                                                                                                seekAudioByLocation(
                                                                                                    audioKey,
                                                                                                    url,
                                                                                                    event
                                                                                                        .nativeEvent
                                                                                                        .locationX,
                                                                                                    false,
                                                                                                );
                                                                                            }}
                                                                                            onResponderMove={(
                                                                                                event,
                                                                                            ) =>
                                                                                                seekAudioByLocation(
                                                                                                    audioKey,
                                                                                                    url,
                                                                                                    event
                                                                                                        .nativeEvent
                                                                                                        .locationX,
                                                                                                    true,
                                                                                                )
                                                                                            }
                                                                                            onResponderRelease={(
                                                                                                event,
                                                                                            ) => {
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
                                                                                            onResponderTerminate={() =>
                                                                                                handleSeekInteractionEnd()
                                                                                            }
                                                                                        >
                                                                                            {waveBars.map((barHeight: number, barIndex: number) => {
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
                                                                                        </View>
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

                                                            {fileAttachments.length >
                                                            0 ? (
                                                                <View
                                                                    style={
                                                                        styles.fileList
                                                                    }
                                                                >
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
                                                                                onPress={() => {
                                                                                    if (
                                                                                        attachment.resolvedUrl
                                                                                    ) {
                                                                                        void Linking.openURL(
                                                                                            attachment.resolvedUrl,
                                                                                        );
                                                                                    }
                                                                                }}
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
                                                                                        style={[
                                                                                            styles.fileSize,
                                                                                            mine &&
                                                                                                styles.fileSizeMine,
                                                                                        ]}
                                                                                    >
                                                                                        {formatFileSize(
                                                                                            attachment.fileSize,
                                                                                        )}
                                                                                    </Text>
                                                                                </View>
                                                                                <View
                                                                                    style={[
                                                                                        styles.fileActionIconWrap,
                                                                                        mine &&
                                                                                            styles.fileActionIconWrapMine,
                                                                                    ]}
                                                                                >
                                                                                    <Ionicons
                                                                                        name="download-outline"
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                        color={
                                                                                            mine
                                                                                                ? colors.white
                                                                                                : "#475569"
                                                                                        }
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
                                                                                size={
                                                                                    18
                                                                                }
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
                                                                                {
                                                                                    callMeta.title
                                                                                }
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
                                                                            Goi
                                                                            lai
                                                                        </Text>
                                                                    </View>
                                                                </Pressable>
                                                            ) : null}

                                                            {shouldShowFallbackText ? (
                                                                <Text
                                                                    style={[
                                                                        styles.messageText,
                                                                        mine &&
                                                                            styles.messageTextMine,
                                                                    ]}
                                                                >
                                                                    {item.content ||
                                                                        "Tin nhan khong co noi dung"}
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
                                                                        {
                                                                            item.content
                                                                        }
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

                                {isLastInGroup && messageTime ? (
                                    <View
                                        style={[
                                            styles.messageMetaRow,
                                            mine
                                                ? styles.messageMetaRowMine
                                                : styles.messageMetaRowOther,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.messageTime,
                                                mine && styles.messageTimeMine,
                                            ]}
                                        >
                                            {messageTime}
                                        </Text>
                                    </View>
                                ) : null}

                                {receiptsForThisMessage.length > 0 ? (
                                    <View
                                        style={[
                                            styles.messageMetaRow,
                                            styles.messageMetaRowMine,
                                        ]}
                                    >
                                        <View style={styles.seenReceiptsRow}>
                                            {receiptsForThisMessage.map(
                                                (receipt) => {
                                                    const member =
                                                        membersById[
                                                            receipt.userId
                                                        ];
                                                    return (
                                                        <UserAvatar
                                                            key={`${item.id}-${receipt.userId}`}
                                                            uri={member?.avatar}
                                                            name={
                                                                member?.nickname ||
                                                                member?.username ||
                                                                "?"
                                                            }
                                                            size={16}
                                                        />
                                                    );
                                                },
                                            )}
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        );

});

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
        maxWidth: "92%",
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
    replyPreviewIconBoxMine: {
        
    },
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
        backgroundColor: "#F3F4F6",
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        width: 180,
    },
    fileItemMine: {
        backgroundColor: "#1D4ED8",
        borderColor: "rgba(255, 255, 255, 0.28)",
    },
    fileBadge: {
        width: 32,
        height: 32,
        borderRadius: 9,
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
    },
    fileBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.white,
    },
    fileMeta: {
        marginLeft: 8,
        flex: 1,
        minWidth: 0,
    },
    fileName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
    },
    fileNameMine: {
        color: colors.white,
    },
    fileSize: {
        marginTop: 2,
        color: colors.textMuted,
        fontSize: 11,
    },
    fileSizeMine: {
        color: "#DBEAFE",
    },
    fileActionIconWrap: {
        marginLeft: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },
    fileActionIconWrapMine: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    callCard: {
        marginTop: 6,
        borderRadius: 14,
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    callCardMine: {
        backgroundColor: "#1D4ED8",
        borderColor: "rgba(255,255,255,0.28)",
    },
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
        flex: 1,
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
        maxWidth: "88%",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#efeff0ff",
        flexDirection: "row",
        alignItems: "center",
    },
    systemMessageText: {
        marginLeft: 6,
        fontSize: 12,
        color: "#4B5563",
        flexShrink: 1,
    },
    systemCollapsedBtn: {
        maxWidth: "88%",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#f5f5f5ff",
        flexDirection: "row",
        alignItems: "center",
    },
    systemCollapsedBtnText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: "700",
        color: "#424344ff",
    },
    seenReceiptsRow: {
        marginTop: 4,
        marginRight: 2,
        alignSelf: "flex-end",
        flexDirection: "row",
        gap: 4,
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
