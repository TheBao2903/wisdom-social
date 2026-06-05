import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
} from "react";
import chatService from "../services/chatService";
import type { Message } from "../services/chatService";
import websocketService, {
    type CallSignalEvent,
    type CallSignalPayload,
    type CallStatus,
} from "../services/websocket";
import chatRuntimeStore from "../stores/chatRuntimeStore";

export type CallType = "audio" | "video";

interface ActiveCall {
    callId: string;
    callType: CallType;
    remoteUserIds: number[];
    participantUserIds: number[];
    hostUserId: number;
    remoteName: string;
    remoteAvatar?: string;
    status: CallStatus;
    isCaller: boolean;
}

interface RejoinableCall {
    callId: string;
    callType: CallType;
    participantUserIds: number[];
}

interface UseCallOptions {
    conversationId: number;
    userId: number;
    callerName?: string;
    callerAvatar?: string;
    targetUserId?: number;
    targetUserIds?: number[];
    targetName?: string;
    targetAvatar?: string;
    pendingIncomingCall?: CallSignalPayload | null;
    onPendingIncomingCallConsumed?: () => void;
    onCallMessageSaved?: (message: Message) => void;
}

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CALLER_RINGTONE_SRC = "/1.mp3";
const RECEIVER_RINGTONE_SRC = "/2.mp3";
const UNANSWERED_CALL_TIMEOUT_MS = 20_000;
const STOP_ALL_CALL_AUDIO_EVENT = "call:stop-all-audio";
export const MAX_CALL_PARTICIPANTS = 8;

function createCallId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSignalParticipantUserIds(signal: CallSignalPayload): number[] {
    const direct = signal.participantUserIds;
    if (direct?.length) return direct.filter(Number.isFinite);

    const candidate = signal.candidate as
        | { participantUserIds?: unknown }
        | undefined;
    if (!Array.isArray(candidate?.participantUserIds)) return [];

    return candidate.participantUserIds
        .map((id) => Number(id))
        .filter(Number.isFinite);
}

function getSignalJoiningUserId(signal: CallSignalPayload): number | null {
    const candidate = signal.candidate as { joiningUserId?: unknown } | undefined;
    const id = Number(candidate?.joiningUserId);
    return Number.isFinite(id) ? id : null;
}

function getSignalHostUserId(signal: CallSignalPayload): number | null {
    const candidate = signal.candidate as { hostUserId?: unknown } | undefined;
    const id = Number(candidate?.hostUserId);
    return Number.isFinite(id) ? id : null;
}

function getSignalCallerInfo(signal: CallSignalPayload): {
    callerName?: string;
    callerAvatar?: string;
} {
    const candidate = signal.candidate as
        | { callerName?: unknown; callerAvatar?: unknown }
        | undefined;
    return {
        callerName:
            typeof candidate?.callerName === "string"
                ? candidate.callerName
                : undefined,
        callerAvatar:
            typeof candidate?.callerAvatar === "string"
                ? candidate.callerAvatar
                : undefined,
    };
}

function getSignalReason(signal: CallSignalPayload): string | null {
    const candidate = signal.candidate as { reason?: unknown } | undefined;
    return typeof candidate?.reason === "string" ? candidate.reason : null;
}

function buildCallMetadata(
    participantUserIds: number[],
    joiningUserId?: number,
    hostUserId?: number,
    callerInfo?: { callerName?: string; callerAvatar?: string },
): Record<string, unknown> {
    return {
        participantUserIds: Array.from(new Set(participantUserIds)),
        ...(joiningUserId != null ? { joiningUserId } : {}),
        ...(hostUserId != null ? { hostUserId } : {}),
        ...(callerInfo?.callerName ? { callerName: callerInfo.callerName } : {}),
        ...(callerInfo?.callerAvatar ? { callerAvatar: callerInfo.callerAvatar } : {}),
    };
}

export function useCall(options: UseCallOptions) {
    const {
        conversationId,
        userId,
        callerName,
        callerAvatar,
        targetUserId,
        targetUserIds,
        targetName,
        targetAvatar,
        pendingIncomingCall,
        onPendingIncomingCallConsumed,
    } = options;
    const { onCallMessageSaved } = options;

    const resolvedTargetUserIds = useMemo(() => {
        if (targetUserIds?.length) {
            return targetUserIds.filter((id) => id !== userId);
        }
        return targetUserId && targetUserId !== userId ? [targetUserId] : [];
    }, [targetUserId, targetUserIds, userId]);

    const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(
        null,
    );
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<
        Array<{ userId: number; stream: MediaStream }>
    >([]);
    const [rejoinableCall, setRejoinableCall] =
        useState<RejoinableCall | null>(null);
    const [busyCallUserId, setBusyCallUserId] = useState<number | null>(null);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(
        new Map(),
    );
    const remoteStreamsRef = useRef<Array<{ userId: number; stream: MediaStream }>>(
        [],
    );
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingIceCandidatesRef = useRef<
        Map<string, RTCIceCandidateInit[]>
    >(new Map());
    const activeCallRef = useRef<ActiveCall | null>(null);
    const durationTimerRef = useRef<number | null>(null);
    const durationSecondsRef = useRef(0);
    const handleCallSignalRef = useRef<
        ((signal: CallSignalPayload) => Promise<void>) | null
    >(null);
    const incomingCallRef = useRef<CallSignalPayload | null>(null);
    const callSavedRef = useRef(false);
    const callerToneRef = useRef<HTMLAudioElement | null>(null);
    const receiverToneRef = useRef<HTMLAudioElement | null>(null);
    const callerToneRetryRef = useRef<number | null>(null);
    const receiverToneRetryRef = useRef<number | null>(null);
    const unansweredTimeoutRef = useRef<number | null>(null);
    const screenTrackRef = useRef<MediaStreamTrack | null>(null);
    const cameraTrackBeforeShareRef = useRef<MediaStreamTrack | null>(null);
    const incomingNotificationRef = useRef<Notification | null>(null);
    const activeCallRequestAtRef = useRef(0);
    const activeCallRequestCallIdRef = useRef<string | null>(null);
    const rejoinProbeTimerRef = useRef<number | null>(null);

    useEffect(() => {
        durationSecondsRef.current = durationSeconds;
    }, [durationSeconds]);

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    useEffect(() => {
        remoteStreamsRef.current = remoteStreams;
    }, [remoteStreams]);

    useEffect(() => {
        if (activeCall) {
            chatRuntimeStore.setActiveCall({
                callId: activeCall.callId,
                conversationId,
                callType: activeCall.callType,
                userId,
            });
            return;
        }

        const currentRuntimeCall = chatRuntimeStore.getActiveCall();
        if (
            currentRuntimeCall?.conversationId === conversationId &&
            currentRuntimeCall.userId === userId
        ) {
            chatRuntimeStore.setActiveCall(null);
        }
    }, [activeCall, conversationId, userId]);

    const clearDurationTimer = useCallback(() => {
        if (durationTimerRef.current != null) {
            window.clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    }, []);

    const ensureToneAudio = useCallback(
        (
            holder: MutableRefObject<HTMLAudioElement | null>,
            src: string,
        ) => {
            if (!holder.current) {
                const audio = new Audio(src);
                audio.loop = true;
                audio.preload = "auto";
                holder.current = audio;
            }
            return holder.current;
        },
        [],
    );

    const playTone = useCallback(
        (
            holder: MutableRefObject<HTMLAudioElement | null>,
            retryRef: MutableRefObject<number | null>,
            src: string,
        ) => {
            const audio = ensureToneAudio(holder, src);
            if (!audio) return;

            if (retryRef.current != null) {
                window.clearInterval(retryRef.current);
                retryRef.current = null;
            }

            audio.currentTime = 0;

            const attemptPlay = () => {
                void audio
                    .play()
                    .then(() => {
                        if (retryRef.current != null) {
                            window.clearInterval(retryRef.current);
                            retryRef.current = null;
                        }
                    })
                    .catch(() => {
                        if (retryRef.current != null) return;
                        retryRef.current = window.setInterval(() => {
                            void audio.play().catch(() => undefined);
                        }, 1000);
                    });
            };

            attemptPlay();
        },
        [ensureToneAudio],
    );

    const stopTone = useCallback(
        (
            holder: MutableRefObject<HTMLAudioElement | null>,
            retryRef: MutableRefObject<number | null>,
        ) => {
            if (retryRef.current != null) {
                window.clearInterval(retryRef.current);
                retryRef.current = null;
            }

            const audio = holder.current;
            if (!audio) return;
            audio.pause();
            audio.currentTime = 0;
        },
        [],
    );

    const startCallerTone = useCallback(() => {
        playTone(callerToneRef, callerToneRetryRef, CALLER_RINGTONE_SRC);
    }, [playTone]);

    const stopCallerTone = useCallback(() => {
        stopTone(callerToneRef, callerToneRetryRef);
    }, [stopTone]);

    const startReceiverTone = useCallback(() => {
        playTone(receiverToneRef, receiverToneRetryRef, RECEIVER_RINGTONE_SRC);
    }, [playTone]);

    const stopReceiverTone = useCallback(() => {
        stopTone(receiverToneRef, receiverToneRetryRef);
    }, [stopTone]);

    const notifyIncomingCall = useCallback((payload: CallSignalPayload) => {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([250, 120, 250]);
        }

        if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
        ) {
            incomingNotificationRef.current?.close();
            const notification = new Notification("Cuộc gọi đến", {
                body: `${payload.fromUserId} đang gọi ${payload.callType === "video" ? "video" : "thoại"}`,
                requireInteraction: true,
                silent: false,
            });
            incomingNotificationRef.current = notification;
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }, []);

    const clearIncomingNotification = useCallback(() => {
        if (incomingNotificationRef.current) {
            incomingNotificationRef.current.close();
            incomingNotificationRef.current = null;
        }
    }, []);

    const broadcastStopAllCallAudio = useCallback(() => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new Event(STOP_ALL_CALL_AUDIO_EVENT));
    }, []);

    const updateLocalPreview = useCallback((stream: MediaStream | null) => {
        if (!stream) {
            setLocalStream(null);
            return;
        }
        setLocalStream(new MediaStream(stream.getTracks()));
    }, []);

    const replaceOutgoingVideoTrack = useCallback(async (
        newTrack: MediaStreamTrack | null,
    ) => {
        const tasks: Promise<void>[] = [];

        peerConnectionsRef.current.forEach((pc) => {
            const videoSender = pc
                .getSenders()
                .find((sender) => sender.track?.kind === "video");

            if (videoSender) {
                tasks.push(
                    videoSender.replaceTrack(newTrack).catch(() => undefined),
                );
                return;
            }

            if (newTrack && localStreamRef.current) {
                try {
                    pc.addTrack(newTrack, localStreamRef.current);
                } catch {
                    // Ignore addTrack conflicts for existing connections.
                }
            }
        });

        await Promise.all(tasks);
    }, []);

    const stopScreenShare = useCallback(async () => {
        const stream = localStreamRef.current;
        if (!stream) {
            setIsScreenSharing(false);
            screenTrackRef.current = null;
            cameraTrackBeforeShareRef.current = null;
            return;
        }

        const screenTrack = screenTrackRef.current;
        if (screenTrack) {
            stream.removeTrack(screenTrack);
            screenTrack.onended = null;
            screenTrack.stop();
            screenTrackRef.current = null;
        }

        let cameraTrack = cameraTrackBeforeShareRef.current;
        cameraTrackBeforeShareRef.current = null;

        if (cameraTrack && cameraTrack.readyState === "ended") {
            cameraTrack = null;
        }

        if (!cameraTrack && activeCallRef.current?.callType === "video") {
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                });
                cameraTrack = camStream.getVideoTracks()[0] ?? null;
            } catch {
                cameraTrack = null;
            }
        }

        if (cameraTrack) {
            cameraTrack.enabled = true;
            stream.addTrack(cameraTrack);
        }

        await replaceOutgoingVideoTrack(cameraTrack ?? null);
        setCameraEnabled(Boolean(cameraTrack?.enabled));
        setIsScreenSharing(false);
        updateLocalPreview(stream);
    }, [replaceOutgoingVideoTrack, updateLocalPreview]);

    const toggleScreenShare = useCallback(async () => {
        if (activeCallRef.current?.callType !== "video") return;
        const stream = localStreamRef.current;
        if (!stream) return;

        if (isScreenSharing) {
            await stopScreenShare();
            return;
        }

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            const displayTrack = displayStream.getVideoTracks()[0];
            if (!displayTrack) return;

            const currentCameraTrack = stream.getVideoTracks()[0] ?? null;
            cameraTrackBeforeShareRef.current = currentCameraTrack;

            if (currentCameraTrack) {
                stream.removeTrack(currentCameraTrack);
                currentCameraTrack.enabled = false;
            }

            stream.addTrack(displayTrack);
            screenTrackRef.current = displayTrack;
            displayTrack.onended = () => {
                void stopScreenShare();
            };

            await replaceOutgoingVideoTrack(displayTrack);
            setIsScreenSharing(true);
            setCameraEnabled(true);
            updateLocalPreview(stream);
        } catch {
            // User cancelled screen share prompt.
        }
    }, [
        isScreenSharing,
        replaceOutgoingVideoTrack,
        stopScreenShare,
        updateLocalPreview,
    ]);

    const primeReceiverTone = useCallback(async () => {
        const audio = ensureToneAudio(receiverToneRef, RECEIVER_RINGTONE_SRC);
        if (!audio) return;

        audio.load();

        const previousMuted = audio.muted;
        audio.muted = true;
        try {
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
        } catch {
            // Ignore unlock failures; regular retry flow handles playback.
        } finally {
            audio.muted = previousMuted;
        }
    }, [ensureToneAudio]);

    const clearUnansweredTimeout = useCallback(() => {
        if (unansweredTimeoutRef.current != null) {
            window.clearTimeout(unansweredTimeoutRef.current);
            unansweredTimeoutRef.current = null;
        }
    }, []);

    const startDurationTimer = useCallback(() => {
        clearDurationTimer();
        const startedAt = Date.now() - durationSecondsRef.current * 1000;
        durationTimerRef.current = window.setInterval(() => {
            setDurationSeconds(
                Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
            );
        }, 1000);
    }, [clearDurationTimer]);

    const persistCallMessage = useCallback(
        async (callType: CallType, status: CallStatus, seconds: number) => {
            if (callSavedRef.current) return;
            callSavedRef.current = true;
            try {
                const savedMessage = await chatService.sendCallMessage(
                    {
                        conversationId,
                        callType,
                        status,
                        durationSeconds: Math.max(0, seconds),
                    },
                    userId,
                );

                const asRecord = savedMessage as unknown as
                    | Record<string, unknown>
                    | undefined;

                const normalizedMessage =
                    asRecord &&
                        typeof asRecord === "object" &&
                        "data" in asRecord &&
                        !("id" in asRecord)
                        ? ((asRecord as { data?: Message }).data ?? null)
                        : savedMessage;

                if (normalizedMessage?.id && normalizedMessage?.createdAt) {
                    onCallMessageSaved?.(normalizedMessage);
                }
            } catch (error) {
                console.error("Failed to persist call message", error);
            }
        },
        [conversationId, onCallMessageSaved, userId],
    );

    const cleanupMedia = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setRemoteStreams([]);
        setMicEnabled(true);
        setCameraEnabled(true);
    }, []);

    const closePeerConnectionForUser = useCallback((remoteUserId: number) => {
        const pc = peerConnectionsRef.current.get(remoteUserId);
        if (!pc) return;

        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
        peerConnectionsRef.current.delete(remoteUserId);
        setRemoteStreams((prev) =>
            prev.filter((item) => item.userId !== remoteUserId),
        );
    }, []);

    const cleanupPeer = useCallback(() => {
        peerConnectionsRef.current.forEach((_pc, remoteUserId) => {
            closePeerConnectionForUser(remoteUserId);
        });
        peerConnectionsRef.current.clear();
    }, [closePeerConnectionForUser]);

    const candidateKey = useCallback(
        (callId: string, remoteUserId: number) => `${callId}:${remoteUserId}`,
        [],
    );

    const queueIceCandidate = useCallback(
        (
            callId: string,
            remoteUserId: number,
            candidate: RTCIceCandidateInit,
        ) => {
            const key = candidateKey(callId, remoteUserId);
            const existing = pendingIceCandidatesRef.current.get(key) ?? [];
            existing.push(candidate);
            pendingIceCandidatesRef.current.set(key, existing);
        },
        [candidateKey],
    );

    const flushQueuedIceCandidates = useCallback(async (
        callId: string,
        remoteUserId: number,
    ) => {
        const key = candidateKey(callId, remoteUserId);
        const pc = peerConnectionsRef.current.get(remoteUserId);
        if (!pc) return;

        const queued = pendingIceCandidatesRef.current.get(key) ?? [];
        if (!queued.length) return;

        for (const candidate of queued) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error("Failed to apply queued ICE candidate", error);
            }
        }

        pendingIceCandidatesRef.current.delete(key);
    }, [candidateKey]);

    const resetCallState = useCallback(() => {
        broadcastStopAllCallAudio();
        clearDurationTimer();
        clearUnansweredTimeout();
        stopCallerTone();
        stopReceiverTone();

        const screenTrack = screenTrackRef.current;
        if (screenTrack) {
            screenTrack.onended = null;
            screenTrack.stop();
            screenTrackRef.current = null;
        }

        const cameraTrack = cameraTrackBeforeShareRef.current;
        if (cameraTrack && cameraTrack.readyState !== "ended") {
            cameraTrack.stop();
        }
        cameraTrackBeforeShareRef.current = null;

        cleanupPeer();
        cleanupMedia();
        pendingIceCandidatesRef.current.clear();
        setIncomingCall(null);
        clearIncomingNotification();
        setActiveCall(null);
        activeCallRef.current = null;
        setDurationSeconds(0);
        setIsScreenSharing(false);
        callSavedRef.current = false;
    }, [
        cleanupMedia,
        cleanupPeer,
        broadcastStopAllCallAudio,
        clearDurationTimer,
        clearUnansweredTimeout,
        clearIncomingNotification,
        stopCallerTone,
        stopReceiverTone,
    ]);

    const startUnansweredTimeout = useCallback(
        (callId: string, callType: CallType, remoteUserIds: number[]) => {
            clearUnansweredTimeout();

            unansweredTimeoutRef.current = window.setTimeout(() => {
                const currentCall = activeCallRef.current;
                if (!currentCall) return;
                if (currentCall.callId !== callId) return;
                if (currentCall.status !== "calling") return;

                stopCallerTone();
                stopReceiverTone();

                remoteUserIds.forEach((remoteUserId) => {
                    websocketService.sendCallSignal({
                        event: "end-call",
                        conversationId,
                        callId,
                        callType,
                        fromUserId: userId,
                        targetUserId: remoteUserId,
                    });
                    closePeerConnectionForUser(remoteUserId);
                });

                void persistCallMessage(callType, "ended", 0);
                resetCallState();
            }, UNANSWERED_CALL_TIMEOUT_MS);
        },
        [
            clearUnansweredTimeout,
            closePeerConnectionForUser,
            conversationId,
            persistCallMessage,
            resetCallState,
            stopCallerTone,
            stopReceiverTone,
            userId,
        ],
    );

    const createLocalStream = useCallback(async (callType: CallType) => {
        const constraints: MediaStreamConstraints =
            callType === "video"
                ? { audio: true, video: true }
                : { audio: true, video: false };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        localStreamRef.current = stream;
        setRejoinableCall(null);

        const hasVideoTrack = stream.getVideoTracks().length > 0;
        setCameraEnabled(hasVideoTrack && stream.getVideoTracks()[0].enabled);
        setMicEnabled(stream.getAudioTracks().every((t) => t.enabled));

        return stream;
    }, []);

    const createPeerConnection = useCallback(
        (remoteUserId: number, callId: string, callType: CallType) => {
            closePeerConnectionForUser(remoteUserId);

            const pc = new RTCPeerConnection(RTC_CONFIG);

            pc.onicecandidate = (event) => {
                if (!event.candidate) return;
                websocketService.sendCallSignal({
                    event: "ice-candidate",
                    conversationId,
                    callId,
                    callType,
                    fromUserId: userId,
                    targetUserId: remoteUserId,
                    candidate: event.candidate.toJSON(),
                });
            };

            pc.ontrack = (event) => {
                const inboundStream = event.streams[0] ?? null;

                setRemoteStreams((prev) => {
                    const existing = prev.find(
                        (item) => item.userId === remoteUserId,
                    );

                    if (existing) {
                        if (inboundStream && existing.stream.id !== inboundStream.id) {
                            return prev.map((item) =>
                                item.userId === remoteUserId
                                    ? { ...item, stream: inboundStream }
                                    : item,
                            );
                        }

                        const hasTrack = existing.stream
                            .getTracks()
                            .some((t) => t.id === event.track.id);
                        if (!hasTrack) existing.stream.addTrack(event.track);
                        return [...prev];
                    }

                    const stream = inboundStream ?? new MediaStream();
                    if (!inboundStream) {
                        stream.addTrack(event.track);
                    }
                    return [...prev, { userId: remoteUserId, stream }];
                });
            };

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current as MediaStream);
                });
            }

            peerConnectionsRef.current.set(remoteUserId, pc);
            return pc;
        },
        [closePeerConnectionForUser, conversationId, userId],
    );

    const resolveCallTargetUserIds = useCallback(async () => {
        const fromProps = resolvedTargetUserIds.filter((id) => id !== userId);

        try {
            const convResp = await chatService.getConversation(
                conversationId,
                userId,
            );
            const fromConversation =
                convResp.success && convResp.data?.members?.length
                    ? convResp.data.members
                        .map((member) => member.userId)
                        .filter((id) => id !== userId)
                    : [];

            return Array.from(new Set([...fromProps, ...fromConversation]));
        } catch {
            return Array.from(new Set(fromProps));
        }
    }, [conversationId, resolvedTargetUserIds, userId]);

    const placeOutgoingCallToUsers = useCallback(
        async (
            callId: string,
            callType: CallType,
            remoteUserIds: number[],
        ) => {
            await Promise.all(
                remoteUserIds.map(async (remoteUserId) => {
                    const pc = createPeerConnection(
                        remoteUserId,
                        callId,
                        callType,
                    );
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    websocketService.sendCallSignal({
                        event: "call-user",
                        conversationId,
                        callId,
                        callType,
                        fromUserId: userId,
                        targetUserId: remoteUserId,
                        sdp: offer,
                        candidate: buildCallMetadata(
                            activeCallRef.current?.participantUserIds ?? [
                                userId,
                            ],
                            undefined,
                            activeCallRef.current?.hostUserId ?? userId,
                            { callerName, callerAvatar },
                        ),
                    });

                    await flushQueuedIceCandidates(callId, remoteUserId);
                }),
            );
        },
        [
            conversationId,
            createPeerConnection,
            flushQueuedIceCandidates,
            callerAvatar,
            callerName,
            userId,
        ],
    );

    const startCall = useCallback(
        async (callType: CallType, selectedUserIds?: number[]) => {
            if (activeCallRef.current) return;

            const targetIds = selectedUserIds?.length
                ? selectedUserIds
                : await resolveCallTargetUserIds();
            const remoteUserIds = Array.from(
                new Set(targetIds.filter((id) => id !== userId)),
            ).slice(0, MAX_CALL_PARTICIPANTS - 1);
            if (!remoteUserIds.length) return;

            const stream = await createLocalStream(callType);
            if (!stream) return;

            const callId = createCallId();

            const nextCall: ActiveCall = {
                callId,
                callType,
                remoteUserIds,
                participantUserIds: [userId],
                hostUserId: userId,
                remoteName:
                    remoteUserIds.length > 1
                        ? `Nhóm (${remoteUserIds.length} người)`
                        : targetName ?? "Người dùng",
                remoteAvatar: targetAvatar,
                status: "calling",
                isCaller: true,
            };

            setActiveCall(nextCall);
            activeCallRef.current = nextCall;
            setRejoinableCall(null);
            setDurationSeconds(0);
            callSavedRef.current = false;
            startCallerTone();

            await placeOutgoingCallToUsers(callId, callType, remoteUserIds);

            startUnansweredTimeout(callId, callType, remoteUserIds);
        },
        [
            createLocalStream,
            placeOutgoingCallToUsers,
            resolveCallTargetUserIds,
            startUnansweredTimeout,
            targetAvatar,
            targetName,
            userId,
            startCallerTone,
        ],
    );

    const inviteUsersToCall = useCallback(
        async (userIds: number[]) => {
            const currentCall = activeCallRef.current;
            if (!currentCall || !localStreamRef.current) return false;

            const existingIds = new Set(currentCall.remoteUserIds);
            const nextRemoteUserIds = Array.from(
                new Set(
                    userIds.filter(
                        (id) => id !== userId && !existingIds.has(id),
                    ),
                ),
            ).slice(
                0,
                Math.max(
                    0,
                    MAX_CALL_PARTICIPANTS - 1 - currentCall.remoteUserIds.length,
                ),
            );

            if (!nextRemoteUserIds.length) return false;

            await placeOutgoingCallToUsers(
                currentCall.callId,
                currentCall.callType,
                nextRemoteUserIds,
            );

            setActiveCall((prev) => {
                if (!prev) return prev;
                const next = {
                    ...prev,
                    remoteUserIds: Array.from(
                        new Set([...prev.remoteUserIds, ...nextRemoteUserIds]),
                    ),
                    participantUserIds: prev.participantUserIds,
                    remoteName:
                        prev.remoteUserIds.length + nextRemoteUserIds.length > 1
                            ? `Nhóm (${prev.remoteUserIds.length + nextRemoteUserIds.length} người)`
                            : prev.remoteName,
                };
                activeCallRef.current = next;
                return next;
            });

            return true;
        },
        [placeOutgoingCallToUsers, userId],
    );

    const updateCallParticipants = useCallback(
        (
            participantUserIds: number[],
            options: { preserveInvitedRemoteIds?: boolean } = {},
        ) => {
            const normalizedParticipantIds = Array.from(
                new Set(participantUserIds.filter(Number.isFinite)),
            );
            if (!normalizedParticipantIds.length) return;

            setActiveCall((prev) => {
                if (!prev) return prev;
                const participantRemoteUserIds = normalizedParticipantIds.filter(
                    (id) => id !== userId,
                );
                const remoteUserIds = options.preserveInvitedRemoteIds === false
                    ? participantRemoteUserIds
                    : Array.from(
                        new Set([
                            ...prev.remoteUserIds,
                            ...participantRemoteUserIds,
                        ]),
                    );
                const next = {
                    ...prev,
                    remoteUserIds,
                    participantUserIds: normalizedParticipantIds,
                    remoteName:
                        normalizedParticipantIds.length > 2
                            ? `Nhóm (${normalizedParticipantIds.length} người)`
                            : prev.remoteName,
                };
                activeCallRef.current = next;
                return next;
            });
        },
        [userId],
    );

    const sendParticipantSnapshot = useCallback(
        (participantUserIds: number[]) => {
            const currentCall = activeCallRef.current;
            if (!currentCall) return;
            const metadata = buildCallMetadata(
                participantUserIds,
                undefined,
                currentCall.hostUserId,
            );
            participantUserIds
                .filter((id) => id !== userId)
                .forEach((targetUserId) => {
                    websocketService.sendCallSignal({
                        event: "call-participants",
                        conversationId,
                        callId: currentCall.callId,
                        callType: currentCall.callType,
                        fromUserId: userId,
                        targetUserId,
                        candidate: metadata,
                    });
                });
        },
        [conversationId, userId],
    );

    const notifyExistingParticipantsToConnect = useCallback(
        (joiningUserId: number, participantUserIds: number[]) => {
            const currentCall = activeCallRef.current;
            if (!currentCall) return;
            const metadata = buildCallMetadata(
                participantUserIds,
                joiningUserId,
                currentCall.hostUserId,
            );
            participantUserIds
                .filter((id) => id !== userId && id !== joiningUserId)
                .forEach((targetUserId) => {
                    websocketService.sendCallSignal({
                        event: "join-call",
                        conversationId,
                        callId: currentCall.callId,
                        callType: currentCall.callType,
                        fromUserId: userId,
                        targetUserId,
                        candidate: metadata,
                    });
                });
        },
        [conversationId, userId],
    );

    const ensurePeerConnectionsForParticipants = useCallback(
        async (
            participantUserIds: number[],
            options: {
                repairMissingStreams?: boolean;
                forceReconnect?: boolean;
            } = {},
        ) => {
            const currentCall = activeCallRef.current;
            if (!currentCall || currentCall.status !== "accepted") return;

            const normalizedParticipantIds = Array.from(
                new Set(participantUserIds.filter(Number.isFinite)),
            );
            if (normalizedParticipantIds.length < 2) return;
            if (Math.min(...normalizedParticipantIds) !== userId) return;

            const missingRemoteUserIds = normalizedParticipantIds.filter((id) => {
                if (id === userId) return false;

                const pc = peerConnectionsRef.current.get(id);
                if (options.forceReconnect) {
                    if (pc) closePeerConnectionForUser(id);
                    return true;
                }

                if (!pc) return true;

                const brokenConnection =
                    pc.connectionState === "failed" ||
                    pc.connectionState === "closed" ||
                    pc.iceConnectionState === "failed" ||
                    pc.iceConnectionState === "closed";
                if (brokenConnection) {
                    closePeerConnectionForUser(id);
                    return true;
                }

                if (!options.repairMissingStreams) return false;

                const hasLiveRemoteStream = remoteStreamsRef.current.some(
                    (item) =>
                        item.userId === id &&
                        item.stream
                            .getTracks()
                            .some((track) => track.readyState === "live"),
                );
                if (hasLiveRemoteStream) return false;

                closePeerConnectionForUser(id);
                return true;
            });
            if (!missingRemoteUserIds.length) return;

            await placeOutgoingCallToUsers(
                currentCall.callId,
                currentCall.callType,
                missingRemoteUserIds,
            );
        },
        [closePeerConnectionForUser, placeOutgoingCallToUsers, userId],
    );

    const schedulePeerRepairForParticipants = useCallback(
        (
            participantUserIds: number[],
            options: {
                repairMissingStreams?: boolean;
                forceReconnect?: boolean;
            } = { repairMissingStreams: true },
        ) => {
            const delays = options.forceReconnect ? [300, 1200, 3000] : [1200];
            delays.forEach((delay) => {
                window.setTimeout(() => {
                    void ensurePeerConnectionsForParticipants(
                        participantUserIds,
                        options,
                    );
                }, delay);
            });
        },
        [ensurePeerConnectionsForParticipants],
    );

    const getRemainingParticipantIds = useCallback(
        (currentCall: ActiveCall, leavingUserId: number) =>
            Array.from(
                new Set([
                    userId,
                    ...currentCall.participantUserIds,
                    ...currentCall.remoteUserIds,
                ]),
            ).filter((id) => Number.isFinite(id) && id !== leavingUserId),
        [userId],
    );

    const continueCallAfterParticipantLeft = useCallback(
        (
            currentCall: ActiveCall,
            remoteUserId: number,
            remainingParticipants: number[],
        ) => {
            const remainingRemoteUserIds = remainingParticipants.filter(
                (id) => id !== userId,
            );
            const nextHostUserId = remainingParticipants.includes(
                currentCall.hostUserId,
            )
                ? currentCall.hostUserId
                : Math.min(...remainingParticipants);

            closePeerConnectionForUser(remoteUserId);

            const nextCall: ActiveCall = {
                ...currentCall,
                remoteUserIds: remainingRemoteUserIds,
                participantUserIds: remainingParticipants,
                hostUserId: nextHostUserId,
                remoteName:
                    remainingParticipants.length > 2
                        ? `Nhóm (${remainingParticipants.length} người)`
                        : currentCall.remoteName,
            };

            activeCallRef.current = nextCall;
            setActiveCall(nextCall);
            sendParticipantSnapshot(remainingParticipants);
            void ensurePeerConnectionsForParticipants(remainingParticipants, {
                forceReconnect: true,
            });
            schedulePeerRepairForParticipants(remainingParticipants, {
                forceReconnect: true,
            });
        },
        [
            closePeerConnectionForUser,
            ensurePeerConnectionsForParticipants,
            schedulePeerRepairForParticipants,
            sendParticipantSnapshot,
            userId,
        ],
    );

    const acceptPeerOffer = useCallback(
        async (signal: CallSignalPayload) => {
            const currentCall = activeCallRef.current;
            if (!currentCall || currentCall.callId !== signal.callId) return;
            if (signal.fromUserId === userId) return;

            const pc = createPeerConnection(
                signal.fromUserId,
                signal.callId,
                signal.callType,
            );
            if (signal.sdp) {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(signal.sdp),
                );
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await flushQueuedIceCandidates(signal.callId, signal.fromUserId);

            const participantUserIds = Array.from(
                new Set([
                    ...currentCall.participantUserIds,
                    ...getSignalParticipantUserIds(signal),
                    signal.fromUserId,
                    userId,
                ]),
            );
            updateCallParticipants(participantUserIds);

            websocketService.sendCallSignal({
                event: "answer-call",
                conversationId,
                callId: signal.callId,
                callType: signal.callType,
                fromUserId: userId,
                targetUserId: signal.fromUserId,
                sdp: answer,
                candidate: buildCallMetadata(
                    participantUserIds,
                    undefined,
                    currentCall.hostUserId,
                ),
            });
        },
        [
            conversationId,
            createPeerConnection,
            flushQueuedIceCandidates,
            updateCallParticipants,
            userId,
        ],
    );

    const acceptIncomingSignal = useCallback(async (signal: CallSignalPayload) => {
        if (activeCallRef.current) return;

        const callType = signal.callType;
        await createLocalStream(callType);

        const pc = createPeerConnection(
            signal.fromUserId,
            signal.callId,
            callType,
        );

        if (signal.sdp) {
            await pc.setRemoteDescription(
                new RTCSessionDescription(signal.sdp),
            );
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await flushQueuedIceCandidates(signal.callId, signal.fromUserId);

        const participantUserIds = Array.from(
            new Set([
                ...getSignalParticipantUserIds(signal),
                signal.fromUserId,
                userId,
            ]),
        );
        const hostUserId = getSignalHostUserId(signal) ?? signal.fromUserId;
        const callerInfo = getSignalCallerInfo(signal);

        const nextCall: ActiveCall = {
            callId: signal.callId,
            callType,
            remoteUserIds: [signal.fromUserId],
            participantUserIds,
            hostUserId,
            remoteName:
                callerInfo.callerName ??
                targetName ??
                `Người dùng ${signal.fromUserId}`,
            remoteAvatar: callerInfo.callerAvatar ?? targetAvatar,
            status: "accepted",
            isCaller: false,
        };

        setActiveCall(nextCall);
        activeCallRef.current = nextCall;
        setRejoinableCall(null);
        setIncomingCall(null);
        stopReceiverTone();
        setDurationSeconds(0);
        startDurationTimer();

        websocketService.sendCallSignal({
            event: "answer-call",
            conversationId,
            callId: signal.callId,
            callType,
            fromUserId: userId,
            targetUserId: signal.fromUserId,
            sdp: answer,
            candidate: buildCallMetadata(
                participantUserIds,
                undefined,
                hostUserId,
            ),
        });
    }, [
        conversationId,
        createLocalStream,
        createPeerConnection,
        flushQueuedIceCandidates,
        startDurationTimer,
        targetAvatar,
        targetName,
        userId,
        stopReceiverTone,
    ]);

    const acceptIncomingCall = useCallback(async () => {
        if (!incomingCall) return;
        await acceptIncomingSignal(incomingCall);
    }, [acceptIncomingSignal, incomingCall]);

    useEffect(() => {
        if (!pendingIncomingCall) return;
        if (pendingIncomingCall.conversationId !== conversationId) return;
        if (activeCallRef.current) return;

        onPendingIncomingCallConsumed?.();
        void acceptIncomingSignal(pendingIncomingCall);
    }, [
        acceptIncomingSignal,
        conversationId,
        onPendingIncomingCallConsumed,
        pendingIncomingCall,
    ]);

    const rejectIncomingCall = useCallback(() => {
        if (!incomingCall) return;

        websocketService.sendCallSignal({
            event: "reject-call",
            conversationId,
            callId: incomingCall.callId,
            callType: incomingCall.callType,
            fromUserId: userId,
            targetUserId: incomingCall.fromUserId,
        });

        broadcastStopAllCallAudio();
        stopReceiverTone();
        setIncomingCall(null);
    }, [
        broadcastStopAllCallAudio,
        conversationId,
        incomingCall,
        stopReceiverTone,
        userId,
    ]);

    const endCall = useCallback(async () => {
        const currentCall = activeCallRef.current;
        if (!currentCall) return;
        const shouldOfferRejoin =
            currentCall.hostUserId !== userId &&
            currentCall.participantUserIds.length > 2 &&
            currentCall.status === "accepted";
        const nextRejoinableCall = shouldOfferRejoin
            ? {
                callId: currentCall.callId,
                callType: currentCall.callType,
                participantUserIds: currentCall.participantUserIds.filter(
                    (id) => id !== userId,
                ),
            }
            : null;

        // Stop local ringtone immediately, do not wait for persistence/network.
        stopCallerTone();
        stopReceiverTone();
        clearUnansweredTimeout();

        const targetUserIds = Array.from(
            new Set([
                ...currentCall.remoteUserIds,
                ...currentCall.participantUserIds,
            ]),
        ).filter((id) => Number.isFinite(id) && id !== userId);

        targetUserIds.forEach((remoteUserId) => {
            websocketService.sendCallSignal({
                event: "end-call",
                conversationId,
                callId: currentCall.callId,
                callType: currentCall.callType,
                fromUserId: userId,
                targetUserId: remoteUserId,
            });

            closePeerConnectionForUser(remoteUserId);
        });

        const shouldPersist = currentCall.isCaller;
        const callType = currentCall.callType;
        const elapsedSeconds = durationSecondsRef.current;

        resetCallState();
        setRejoinableCall(nextRejoinableCall);

        if (shouldPersist) {
            void persistCallMessage(callType, "ended", elapsedSeconds);
        }

    }, [
        clearUnansweredTimeout,
        closePeerConnectionForUser,
        conversationId,
        persistCallMessage,
        resetCallState,
        stopCallerTone,
        stopReceiverTone,
        userId,
    ]);

    const rejoinActiveCall = useCallback(async () => {
        const call = rejoinableCall;
        if (!call || activeCallRef.current) return;

        activeCallRequestAtRef.current = Date.now();
        activeCallRequestCallIdRef.current = call.callId;
        call.participantUserIds.forEach((targetUserId) => {
            websocketService.sendCallSignal({
                event: "request-active-call",
                conversationId,
                callId: call.callId,
                callType: call.callType,
                fromUserId: userId,
                targetUserId,
            });
        });
    }, [conversationId, rejoinableCall, userId]);

    const toggleMic = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;

        stream.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });
        setMicEnabled(stream.getAudioTracks().every((t) => t.enabled));
    }, []);

    const toggleCamera = useCallback(() => {
        if (isScreenSharing) return;

        const stream = localStreamRef.current;
        if (!stream) return;

        const tracks = stream.getVideoTracks();
        if (!tracks.length) return;

        tracks.forEach((track) => {
            track.enabled = !track.enabled;
        });
        setCameraEnabled(tracks.every((t) => t.enabled));
    }, [isScreenSharing]);

    const applyStatus = useCallback((status: CallStatus) => {
        setActiveCall((prev) => {
            if (!prev) return prev;
            const next = { ...prev, status };
            activeCallRef.current = next;
            return next;
        });
    }, []);

    const handleCallSignal = useCallback(
        async (signal: CallSignalPayload) => {
            if (signal.conversationId !== conversationId) return;

            const currentCall = activeCallRef.current;

            if (
                signal.event === "incoming-call" ||
                signal.event === "call-user"
            ) {
                if (currentCall?.callId === signal.callId) {
                    await acceptPeerOffer(signal);
                    return;
                }

                if (!currentCall) {
                    const shouldAutoAccept =
                        Date.now() - activeCallRequestAtRef.current < 8000 &&
                        activeCallRequestCallIdRef.current === signal.callId &&
                        getSignalParticipantUserIds(signal).length > 0;
                    if (shouldAutoAccept) {
                        activeCallRequestCallIdRef.current = null;
                        await acceptIncomingSignal(signal);
                        return;
                    }

                    setIncomingCall(signal);
                    startReceiverTone();
                    notifyIncomingCall(signal);
                } else {
                    websocketService.sendCallSignal({
                        event: "reject-call",
                        conversationId,
                        callId: signal.callId,
                        callType: signal.callType,
                        fromUserId: userId,
                        targetUserId: signal.fromUserId,
                        candidate: { reason: "busy" },
                    });
                }
                return;
            }

            if (signal.event === "request-active-call") {
                if (!currentCall || currentCall.status !== "accepted") return;
                if (currentCall.participantUserIds.includes(signal.fromUserId)) {
                    return;
                }
                const leaderId = Math.min(...currentCall.participantUserIds);
                if (leaderId !== userId) return;

                const participantUserIds = Array.from(
                    new Set([...currentCall.participantUserIds, signal.fromUserId]),
                );
                updateCallParticipants(participantUserIds);
                await placeOutgoingCallToUsers(currentCall.callId, currentCall.callType, [
                    signal.fromUserId,
                ]);
                notifyExistingParticipantsToConnect(
                    signal.fromUserId,
                    participantUserIds,
                );
                sendParticipantSnapshot(participantUserIds);
                void ensurePeerConnectionsForParticipants(participantUserIds, {
                    forceReconnect: true,
                });
                schedulePeerRepairForParticipants(participantUserIds, {
                    forceReconnect: true,
                });
                return;
            }

            if (signal.event === "check-active-call") {
                if (!currentCall || currentCall.status !== "accepted") return;
                websocketService.sendCallSignal({
                    event: "call-participants",
                    conversationId,
                    callId: currentCall.callId,
                    callType: currentCall.callType,
                    fromUserId: userId,
                    targetUserId: signal.fromUserId,
                    candidate: buildCallMetadata(
                        currentCall.participantUserIds,
                        undefined,
                        currentCall.hostUserId,
                    ),
                });
                return;
            }

            if (signal.event === "join-call") {
                if (!currentCall || currentCall.callId !== signal.callId) return;
                const joiningUserId = getSignalJoiningUserId(signal);
                if (!joiningUserId || joiningUserId === userId) return;

                const participantUserIds = getSignalParticipantUserIds(signal);
                updateCallParticipants(participantUserIds);
                if (peerConnectionsRef.current.has(joiningUserId)) {
                    closePeerConnectionForUser(joiningUserId);
                }
                await placeOutgoingCallToUsers(signal.callId, signal.callType, [
                    joiningUserId,
                ]);
                schedulePeerRepairForParticipants(participantUserIds, {
                    forceReconnect: true,
                });
                return;
            }

            if (signal.event === "call-participants") {
                if (currentCall?.callId === signal.callId) {
                    const participantUserIds =
                        getSignalParticipantUserIds(signal);
                    updateCallParticipants(participantUserIds);
                    void ensurePeerConnectionsForParticipants(participantUserIds, {
                        forceReconnect: true,
                    });
                    schedulePeerRepairForParticipants(participantUserIds, {
                        forceReconnect: true,
                    });
                } else {
                    const participantUserIds = getSignalParticipantUserIds(signal);
                    if (
                        participantUserIds.length > 1 &&
                        !participantUserIds.includes(userId)
                    ) {
                        setRejoinableCall({
                            callId: signal.callId,
                            callType: signal.callType,
                            participantUserIds,
                        });
                    } else if (participantUserIds.length <= 1) {
                        setRejoinableCall(null);
                    }
                }
                return;
            }

            // Nếu bên gọi đã huỷ/kết thúc khi mình chưa accept,
            // cần đóng modal incoming để tránh UI treo.
            const currentIncomingCall = incomingCallRef.current;
            if (
                (signal.event === "end-call" ||
                    signal.event === "reject-call") &&
                currentIncomingCall?.callId === signal.callId &&
                currentIncomingCall?.fromUserId === signal.fromUserId
            ) {
                stopReceiverTone();
                setIncomingCall(null);
                clearIncomingNotification();
            }

            if (!currentCall || currentCall.callId !== signal.callId) return;

            const remoteUserId = signal.fromUserId;

            if (signal.event === "answer-call") {
                const pc = peerConnectionsRef.current.get(remoteUserId);
                if (signal.sdp && pc) {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(signal.sdp),
                    );
                    await flushQueuedIceCandidates(signal.callId, remoteUserId);
                    clearUnansweredTimeout();
                    stopCallerTone();
                    const wasAlreadyAccepted =
                        currentCall.status === "accepted";
                    applyStatus("accepted");
                    const previousParticipantIds =
                        currentCall.participantUserIds;
                    const participantUserIds = Array.from(
                        new Set([
                            ...previousParticipantIds,
                            ...getSignalParticipantUserIds(signal),
                            remoteUserId,
                            userId,
                        ]),
                    );
                    const participantSetChanged =
                        participantUserIds.length !==
                        previousParticipantIds.length ||
                        participantUserIds.some(
                            (id) => !previousParticipantIds.includes(id),
                        );
                    updateCallParticipants(participantUserIds);
                    if (participantSetChanged) {
                        notifyExistingParticipantsToConnect(
                            remoteUserId,
                            participantUserIds,
                        );
                        sendParticipantSnapshot(participantUserIds);
                        void ensurePeerConnectionsForParticipants(
                            participantUserIds,
                            { forceReconnect: true },
                        );
                        schedulePeerRepairForParticipants(participantUserIds, {
                            forceReconnect: true,
                        });
                    }
                    if (!wasAlreadyAccepted) {
                        setDurationSeconds(0);
                        durationSecondsRef.current = 0;
                        startDurationTimer();
                    }
                }
                return;
            }

            if (signal.event === "ice-candidate") {
                if (!signal.candidate) return;

                const pc = peerConnectionsRef.current.get(remoteUserId);
                if (!pc) {
                    queueIceCandidate(
                        signal.callId,
                        remoteUserId,
                        signal.candidate as RTCIceCandidateInit,
                    );
                    return;
                }

                try {
                    await pc.addIceCandidate(
                        new RTCIceCandidate(
                            signal.candidate as RTCIceCandidateInit,
                        ),
                    );
                } catch {
                    queueIceCandidate(
                        signal.callId,
                        remoteUserId,
                        signal.candidate as RTCIceCandidateInit,
                    );
                }
                return;
            }

            if (signal.event === "reject-call") {
                if (remoteUserId === currentCall.hostUserId) {
                    const remainingParticipants = getRemainingParticipantIds(
                        currentCall,
                        remoteUserId,
                    );
                    if (remainingParticipants.length <= 1) {
                        resetCallState();
                        setRejoinableCall(null);
                    } else {
                        continueCallAfterParticipantLeft(
                            currentCall,
                            remoteUserId,
                            remainingParticipants,
                        );
                    }
                    return;
                }

                if (currentCall.isCaller) {
                    if (getSignalReason(signal) === "busy") {
                        setBusyCallUserId(remoteUserId);
                    }
                    const remainingParticipants = getRemainingParticipantIds(
                        currentCall,
                        remoteUserId,
                    );
                    const remaining = remainingParticipants.filter(
                        (id) => id !== userId,
                    );
                    closePeerConnectionForUser(remoteUserId);

                    if (!remaining.length) {
                        stopCallerTone();
                        resetCallState();
                        void persistCallMessage(
                            currentCall.callType,
                            "rejected",
                            0,
                        );
                        return;
                    }

                    setActiveCall((prev) =>
                        prev
                            ? {
                                ...prev,
                                remoteUserIds: remaining,
                                participantUserIds: remainingParticipants,
                            }
                            : prev,
                    );
                    activeCallRef.current = {
                        ...currentCall,
                        remoteUserIds: remaining,
                        participantUserIds: remainingParticipants,
                    };
                    sendParticipantSnapshot(remainingParticipants);
                    void ensurePeerConnectionsForParticipants(
                        remainingParticipants,
                    );
                    schedulePeerRepairForParticipants(remainingParticipants);
                }
                return;
            }

            if (signal.event === "end-call") {
                if (remoteUserId === currentCall.hostUserId) {
                    resetCallState();
                    setRejoinableCall(null);
                    return;
                }

                const remainingParticipants = getRemainingParticipantIds(
                    currentCall,
                    remoteUserId,
                );

                if (!currentCall.isCaller && remainingParticipants.length <= 1) {
                    resetCallState();
                    return;
                }

                const remaining = remainingParticipants.filter(
                    (id) => id !== userId,
                );
                closePeerConnectionForUser(remoteUserId);

                if (remainingParticipants.length <= 1) {
                    if (currentCall.hostUserId === userId) {
                        remaining.forEach((targetUserId) => {
                            websocketService.sendCallSignal({
                                event: "end-call",
                                conversationId,
                                callId: currentCall.callId,
                                callType: currentCall.callType,
                                fromUserId: userId,
                                targetUserId,
                            });
                        });
                    }

                    stopCallerTone();
                    const elapsedSeconds = durationSecondsRef.current;
                    resetCallState();
                    void persistCallMessage(
                        currentCall.callType,
                        "ended",
                        elapsedSeconds,
                    );
                    return;
                }

                continueCallAfterParticipantLeft(
                    currentCall,
                    remoteUserId,
                    remainingParticipants,
                );
            }
        },
        [
            acceptIncomingSignal,
            acceptPeerOffer,
            applyStatus,
            closePeerConnectionForUser,
            continueCallAfterParticipantLeft,
            conversationId,
            clearIncomingNotification,
            flushQueuedIceCandidates,
            ensurePeerConnectionsForParticipants,
            getRemainingParticipantIds,
            notifyIncomingCall,
            notifyExistingParticipantsToConnect,
            persistCallMessage,
            placeOutgoingCallToUsers,
            queueIceCandidate,
            resetCallState,
            clearUnansweredTimeout,
            schedulePeerRepairForParticipants,
            sendParticipantSnapshot,
            startDurationTimer,
            startReceiverTone,
            stopCallerTone,
            stopReceiverTone,
            updateCallParticipants,
            userId,
        ],
    );

    useEffect(() => {
        handleCallSignalRef.current = handleCallSignal;
    }, [handleCallSignal]);

    useEffect(() => {
        const stopAllAudio = () => {
            stopCallerTone();
            stopReceiverTone();
            clearIncomingNotification();
        };

        window.addEventListener(STOP_ALL_CALL_AUDIO_EVENT, stopAllAudio);
        return () => {
            window.removeEventListener(
                STOP_ALL_CALL_AUDIO_EVENT,
                stopAllAudio,
            );
        };
    }, [clearIncomingNotification, stopCallerTone, stopReceiverTone]);

    useEffect(() => {
        const unlockOnGesture = () => {
            void primeReceiverTone();
            if (incomingCallRef.current) {
                startReceiverTone();
            }
            window.removeEventListener("pointerdown", unlockOnGesture);
            window.removeEventListener("keydown", unlockOnGesture);
            window.removeEventListener("touchstart", unlockOnGesture);
        };

        window.addEventListener("pointerdown", unlockOnGesture, {
            once: true,
        });
        window.addEventListener("keydown", unlockOnGesture, { once: true });
        window.addEventListener("touchstart", unlockOnGesture, {
            once: true,
        });

        return () => {
            window.removeEventListener("pointerdown", unlockOnGesture);
            window.removeEventListener("keydown", unlockOnGesture);
            window.removeEventListener("touchstart", unlockOnGesture);
        };
    }, [primeReceiverTone, startReceiverTone]);

    useEffect(() => {
        void primeReceiverTone();
    }, [primeReceiverTone]);

    useEffect(() => {
        const onCallEvent = (event: CallSignalPayload) => {
            void handleCallSignalRef.current?.(event);
        };

        let disposed = false;
        const setup = async () => {
            if (!websocketService.isConnected()) {
                await websocketService.connect();
            }
            if (disposed) return;
            websocketService.subscribeToCallEvents(userId, onCallEvent);
            const targetIds = await resolveCallTargetUserIds();
            if (disposed || activeCallRef.current) return;
            targetIds.forEach((targetUserId) => {
                websocketService.sendCallSignal({
                    event: "request-active-call",
                    conversationId,
                    callId: `conversation-${conversationId}`,
                    callType: "audio",
                    fromUserId: userId,
                    targetUserId,
                });
            });
        };

        void setup();

        return () => {
            disposed = true;
            websocketService.unsubscribeFromCallEvents(userId, onCallEvent);
        };
    }, [conversationId, resolveCallTargetUserIds, userId]);

    useEffect(() => {
        if (rejoinProbeTimerRef.current != null) {
            window.clearTimeout(rejoinProbeTimerRef.current);
            rejoinProbeTimerRef.current = null;
        }

        if (!rejoinableCall) return;

        rejoinableCall.participantUserIds.forEach((targetUserId) => {
            websocketService.sendCallSignal({
                event: "check-active-call",
                conversationId,
                callId: rejoinableCall.callId,
                callType: rejoinableCall.callType,
                fromUserId: userId,
                targetUserId,
            });
        });

        rejoinProbeTimerRef.current = window.setTimeout(() => {
            setRejoinableCall(null);
            rejoinProbeTimerRef.current = null;
        }, 7000);

        return () => {
            if (rejoinProbeTimerRef.current != null) {
                window.clearTimeout(rejoinProbeTimerRef.current);
                rejoinProbeTimerRef.current = null;
            }
        };
    }, [conversationId, rejoinableCall, userId]);

    useEffect(() => {
        return () => {
            if (rejoinProbeTimerRef.current != null) {
                window.clearTimeout(rejoinProbeTimerRef.current);
                rejoinProbeTimerRef.current = null;
            }
            const currentRuntimeCall = chatRuntimeStore.getActiveCall();
            if (
                currentRuntimeCall?.conversationId === conversationId &&
                currentRuntimeCall.userId === userId
            ) {
                chatRuntimeStore.setActiveCall(null);
            }

            resetCallState();
            clearIncomingNotification();

            if (callerToneRef.current) {
                stopTone(callerToneRef, callerToneRetryRef);
                callerToneRef.current = null;
            }

            if (receiverToneRef.current) {
                stopTone(receiverToneRef, receiverToneRetryRef);
                receiverToneRef.current = null;
            }
        };
    }, [clearIncomingNotification, conversationId, resetCallState, stopTone, userId]);

    const callStatus: CallStatus | null = activeCall?.status ?? null;

    const callDurationText = useMemo(() => {
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }, [durationSeconds]);

    const isInCall = Boolean(activeCall);
    const canToggleCamera = activeCall?.callType === "video";
    const canShareScreen = activeCall?.callType === "video";
    const remoteStream = remoteStreams[0]?.stream ?? null;

    return {
        incomingCall,
        activeCall,
        callStatus,
        localStream,
        remoteStream,
        remoteStreams,
        durationSeconds,
        callDurationText,
        micEnabled,
        cameraEnabled,
        isScreenSharing,
        isInCall,
        rejoinableCall,
        busyCallUserId,
        canToggleCamera,
        canShareScreen,

        startCall,
        rejoinActiveCall,
        clearBusyCallNotice: () => setBusyCallUserId(null),
        acceptIncomingCall,
        rejectIncomingCall,
        endCall,
        toggleMic,
        toggleCamera,
        toggleScreenShare,
        inviteUsersToCall,
        maxCallParticipants: MAX_CALL_PARTICIPANTS,
    };
}

export type { CallSignalPayload, CallStatus, CallSignalEvent };
