import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import IncomingCallModal from "./IncomingCallModal";
import websocketService, {
    type CallSignalPayload,
} from "../../services/websocket";
import { useAuth } from "../../contexts/AuthContext";
import chatRuntimeStore from "../../stores/chatRuntimeStore";

const RECEIVER_RINGTONE_SRC = "/2.mp3";
const STOP_ALL_CALL_AUDIO_EVENT = "call:stop-all-audio";
const PENDING_INCOMING_CALL_KEY = "pending_incoming_call";

function getConversationIdFromPath(pathname: string): number | null {
    const match = pathname.match(/^\/messages\/(\d+)(?:\/call)?$/);
    if (!match) return null;

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function getSignalCallerInfo(payload: CallSignalPayload): {
    callerName?: string;
    callerAvatar?: string;
} {
    const candidate = payload.candidate as
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

export default function GlobalIncomingCallNotifier() {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(
        null,
    );

    const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
    const ringtoneRetryRef = useRef<number | null>(null);
    const incomingCallRef = useRef<CallSignalPayload | null>(null);
    const incomingNotificationRef = useRef<Notification | null>(null);

    const userId = currentUser?.id ?? 0;
    const currentConversationId = useMemo(
        () => getConversationIdFromPath(location.pathname),
        [location.pathname],
    );
    const incomingCallerInfo = incomingCall
        ? getSignalCallerInfo(incomingCall)
        : {};

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    const stopRingtone = useCallback(() => {
        if (ringtoneRetryRef.current != null) {
            window.clearInterval(ringtoneRetryRef.current);
            ringtoneRetryRef.current = null;
        }

        if (!ringtoneAudioRef.current) return;
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
    }, []);

    const primeRingtoneAudio = useCallback(async () => {
        if (!ringtoneAudioRef.current) {
            const audio = new Audio(RECEIVER_RINGTONE_SRC);
            audio.loop = true;
            audio.preload = "auto";
            ringtoneAudioRef.current = audio;
        }

        const audio = ringtoneAudioRef.current;
        if (!audio) return;

        audio.load();

        const previousMuted = audio.muted;
        audio.muted = true;
        try {
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
        } catch {
            // Ignore unlock failures; normal play flow still retries later.
        } finally {
            audio.muted = previousMuted;
        }
    }, []);

    const startRingtone = useCallback(() => {
        if (!ringtoneAudioRef.current) {
            const audio = new Audio(RECEIVER_RINGTONE_SRC);
            audio.loop = true;
            audio.preload = "auto";
            ringtoneAudioRef.current = audio;
        }

        const audio = ringtoneAudioRef.current;
        if (!audio) return;

        audio.currentTime = 0;

        void audio
            .play()
            .then(() => {
                if (ringtoneRetryRef.current != null) {
                    window.clearInterval(ringtoneRetryRef.current);
                    ringtoneRetryRef.current = null;
                }
            })
            .catch(() => {
                if (ringtoneRetryRef.current != null) return;
                ringtoneRetryRef.current = window.setInterval(() => {
                    void audio.play().catch(() => undefined);
                }, 1000);
            });
    }, []);

    const clearIncoming = useCallback(() => {
        setIncomingCall(null);
        stopRingtone();
        if (incomingNotificationRef.current) {
            incomingNotificationRef.current.close();
            incomingNotificationRef.current = null;
        }
    }, [stopRingtone]);

    const stopIncomingAudioOnly = useCallback(() => {
        stopRingtone();
        if (incomingNotificationRef.current) {
            incomingNotificationRef.current.close();
            incomingNotificationRef.current = null;
        }
    }, [stopRingtone]);

    const broadcastStopAllCallAudio = useCallback(() => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new Event(STOP_ALL_CALL_AUDIO_EVENT));
    }, []);

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
                body: `Người dùng ${payload.fromUserId} đang gọi ${payload.callType === "video" ? "video" : "thoại"}`,
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

    const rejectIncomingCall = useCallback(() => {
        if (!incomingCall) return;
        if (!userId) return;

        websocketService.sendCallSignal({
            event: "reject-call",
            conversationId: incomingCall.conversationId,
            callId: incomingCall.callId,
            callType: incomingCall.callType,
            fromUserId: userId,
            targetUserId: incomingCall.fromUserId,
        });

        broadcastStopAllCallAudio();
        clearIncoming();
    }, [broadcastStopAllCallAudio, clearIncoming, incomingCall, userId]);

    const openConversation = useCallback(() => {
        if (!incomingCall) return;

        broadcastStopAllCallAudio();
        stopRingtone();
        sessionStorage.setItem(
            PENDING_INCOMING_CALL_KEY,
            JSON.stringify(incomingCall),
        );
        navigate(`/messages/${incomingCall.conversationId}/call`);
    }, [
        broadcastStopAllCallAudio,
        incomingCall,
        navigate,
        stopRingtone,
    ]);

    useEffect(() => {
        let active = true;
        if (!userId) return;

        const onCallEvent = (event: CallSignalPayload) => {
            if (!active) return;

            if (
                event.event === "incoming-call" ||
                event.event === "call-user"
            ) {
                const activeCall = chatRuntimeStore.getActiveCall();
                if (
                    activeCall &&
                    activeCall.userId === userId &&
                    activeCall.callId !== event.callId
                ) {
                    websocketService.sendCallSignal({
                        event: "reject-call",
                        conversationId: event.conversationId,
                        callId: event.callId,
                        callType: event.callType,
                        fromUserId: userId,
                        targetUserId: event.fromUserId,
                        candidate: { reason: "busy" },
                    });
                    return;
                }

                if (currentConversationId === event.conversationId) {
                    return;
                }
                setIncomingCall(event);
                startRingtone();
                notifyIncomingCall(event);
                return;
            }

            if (
                (event.event === "reject-call" || event.event === "end-call") &&
                incomingCallRef.current?.callId === event.callId &&
                incomingCallRef.current?.fromUserId === event.fromUserId
            ) {
                clearIncoming();
            }
        };

        const setup = async () => {
            if (!websocketService.isConnected()) {
                await websocketService.connect();
            }

            if (!active) return;

            websocketService.subscribeToCallEvents(userId, onCallEvent);
        };

        void setup();

        return () => {
            active = false;
            websocketService.unsubscribeFromCallEvents(userId, onCallEvent);
            stopRingtone();
        };
    }, [
        clearIncoming,
        currentConversationId,
        notifyIncomingCall,
        startRingtone,
        stopRingtone,
        userId,
    ]);

    useEffect(() => {
        if (!incomingCall) return;
        if (currentConversationId !== incomingCall.conversationId) return;

        const timer = window.setTimeout(clearIncoming, 0);
        return () => window.clearTimeout(timer);
    }, [clearIncoming, currentConversationId, incomingCall]);

    useEffect(() => {
        const stopAllAudio = () => {
            stopIncomingAudioOnly();
        };

        window.addEventListener(STOP_ALL_CALL_AUDIO_EVENT, stopAllAudio);
        return () => {
            window.removeEventListener(STOP_ALL_CALL_AUDIO_EVENT, stopAllAudio);
        };
    }, [stopIncomingAudioOnly]);

    useEffect(() => {
        const unlockOnGesture = () => {
            void primeRingtoneAudio();
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
    }, [primeRingtoneAudio]);

    useEffect(() => {
        void primeRingtoneAudio();
    }, [primeRingtoneAudio]);

    useEffect(() => {
        return () => {
            stopRingtone();
            if (ringtoneAudioRef.current) {
                ringtoneAudioRef.current.pause();
                ringtoneAudioRef.current.currentTime = 0;
                ringtoneAudioRef.current = null;
            }
            if (incomingNotificationRef.current) {
                incomingNotificationRef.current.close();
                incomingNotificationRef.current = null;
            }
        };
    }, [stopRingtone]);

    return (
        <IncomingCallModal
            open={Boolean(incomingCall)}
            callerName={
                incomingCallerInfo.callerName ||
                (incomingCall
                    ? `Người dùng ${incomingCall.fromUserId}`
                    : "Người dùng")
            }
            callType={incomingCall?.callType || "audio"}
            onAccept={openConversation}
            onReject={rejectIncomingCall}
            acceptLabel="Mở hội thoại"
        />
    );
}
