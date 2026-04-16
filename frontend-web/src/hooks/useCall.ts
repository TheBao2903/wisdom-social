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

export type CallType = "audio" | "video";

interface ActiveCall {
    callId: string;
    callType: CallType;
    remoteUserIds: number[];
    remoteName: string;
    remoteAvatar?: string;
    status: CallStatus;
    isCaller: boolean;
}

interface UseCallOptions {
    conversationId: number;
    userId: number;
    targetUserId?: number;
    targetUserIds?: number[];
    targetName?: string;
    targetAvatar?: string;
    onCallMessageSaved?: (message: Message) => void;
}

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CALLER_RINGTONE_SRC = "/1.mp3";
const RECEIVER_RINGTONE_SRC = "/2.mp3";
const UNANSWERED_CALL_TIMEOUT_MS = 20_000;
const STOP_ALL_CALL_AUDIO_EVENT = "call:stop-all-audio";

function createCallId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useCall(options: UseCallOptions) {
    const {
        conversationId,
        userId,
        targetUserId,
        targetUserIds,
        targetName,
        targetAvatar,
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
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(
        new Map(),
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

    useEffect(() => {
        durationSecondsRef.current = durationSeconds;
    }, [durationSeconds]);

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

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

    const startCall = useCallback(
        async (callType: CallType) => {
            if (activeCallRef.current) return;

            const remoteUserIds = await resolveCallTargetUserIds();
            if (!remoteUserIds.length) return;

            const stream = await createLocalStream(callType);
            if (!stream) return;

            const callId = createCallId();

            const nextCall: ActiveCall = {
                callId,
                callType,
                remoteUserIds,
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
            setDurationSeconds(0);
            callSavedRef.current = false;
            startCallerTone();

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
                    });

                    await flushQueuedIceCandidates(callId, remoteUserId);
                }),
            );

            startUnansweredTimeout(callId, callType, remoteUserIds);
        },
        [
            conversationId,
            createLocalStream,
            createPeerConnection,
            flushQueuedIceCandidates,
            resolveCallTargetUserIds,
            startUnansweredTimeout,
            targetAvatar,
            targetName,
            userId,
            startCallerTone,
        ],
    );

    const acceptIncomingCall = useCallback(async () => {
        if (!incomingCall) return;

        const callType = incomingCall.callType;
        await createLocalStream(callType);

        const pc = createPeerConnection(
            incomingCall.fromUserId,
            incomingCall.callId,
            callType,
        );

        if (incomingCall.sdp) {
            await pc.setRemoteDescription(
                new RTCSessionDescription(incomingCall.sdp),
            );
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await flushQueuedIceCandidates(incomingCall.callId, incomingCall.fromUserId);

        const nextCall: ActiveCall = {
            callId: incomingCall.callId,
            callType,
            remoteUserIds: [incomingCall.fromUserId],
            remoteName: targetName ?? `Người dùng ${incomingCall.fromUserId}`,
            remoteAvatar: targetAvatar,
            status: "accepted",
            isCaller: false,
        };

        setActiveCall(nextCall);
        activeCallRef.current = nextCall;
        setIncomingCall(null);
        stopReceiverTone();
        setDurationSeconds(0);
        startDurationTimer();

        websocketService.sendCallSignal({
            event: "answer-call",
            conversationId,
            callId: incomingCall.callId,
            callType,
            fromUserId: userId,
            targetUserId: incomingCall.fromUserId,
            sdp: answer,
        });
    }, [
        conversationId,
        createLocalStream,
        createPeerConnection,
        flushQueuedIceCandidates,
        incomingCall,
        startDurationTimer,
        targetAvatar,
        targetName,
        userId,
        stopReceiverTone,
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

        // Stop local ringtone immediately, do not wait for persistence/network.
        stopCallerTone();
        stopReceiverTone();
        clearUnansweredTimeout();

        currentCall.remoteUserIds.forEach((remoteUserId) => {
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
                if (!currentCall) {
                    setIncomingCall(signal);
                    startReceiverTone();
                    notifyIncomingCall(signal);
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
                    applyStatus("accepted");
                    setDurationSeconds(0);
                    startDurationTimer();
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
                        signal.candidate,
                    );
                    return;
                }

                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch {
                    queueIceCandidate(
                        signal.callId,
                        remoteUserId,
                        signal.candidate,
                    );
                }
                return;
            }

            if (signal.event === "reject-call") {
                if (currentCall.isCaller) {
                    const remaining = currentCall.remoteUserIds.filter(
                        (id) => id !== remoteUserId,
                    );
                    closePeerConnectionForUser(remoteUserId);
                    setRemoteStreams((prev) =>
                        prev.filter((item) => item.userId !== remoteUserId),
                    );

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
                        prev ? { ...prev, remoteUserIds: remaining } : prev,
                    );
                    activeCallRef.current = {
                        ...currentCall,
                        remoteUserIds: remaining,
                    };
                }
                return;
            }

            if (signal.event === "end-call") {
                if (!currentCall.isCaller) {
                    resetCallState();
                    return;
                }

                const remaining = currentCall.remoteUserIds.filter(
                    (id) => id !== remoteUserId,
                );
                closePeerConnectionForUser(remoteUserId);
                setRemoteStreams((prev) =>
                    prev.filter((item) => item.userId !== remoteUserId),
                );

                if (!remaining.length) {
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

                setActiveCall((prev) =>
                    prev ? { ...prev, remoteUserIds: remaining } : prev,
                );
                activeCallRef.current = {
                    ...currentCall,
                    remoteUserIds: remaining,
                };
            }
        },
        [
            applyStatus,
            closePeerConnectionForUser,
            conversationId,
            clearIncomingNotification,
            flushQueuedIceCandidates,
            notifyIncomingCall,
            persistCallMessage,
            queueIceCandidate,
            resetCallState,
            clearUnansweredTimeout,
            startDurationTimer,
            startReceiverTone,
            stopCallerTone,
            stopReceiverTone,
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

        const setup = async () => {
            if (!websocketService.isConnected()) {
                await websocketService.connect();
            }
            websocketService.subscribeToCallEvents(userId, onCallEvent);
        };

        void setup();

        return () => {
            websocketService.unsubscribeFromCallEvents(userId, onCallEvent);
        };
    }, [userId]);

    useEffect(() => {
        return () => {
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
    }, [clearIncomingNotification, resetCallState, stopTone]);

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
        canToggleCamera,
        canShareScreen,

        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endCall,
        toggleMic,
        toggleCamera,
        toggleScreenShare,
    };
}

export type { CallSignalPayload, CallStatus, CallSignalEvent };
