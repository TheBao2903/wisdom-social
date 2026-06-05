import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { useAppContext } from "@/context/AppContext";
import chatWebsocketService, {
    type CallSignalPayload,
} from "@/services/chatWebsocketService";
import { setPendingIncomingCall } from "@/utils/pendingIncomingCall";
import chatRuntimeStore from "@/stores/chatRuntimeStore";

function getConversationIdFromPath(pathname: string): number | null {
    const match = pathname.match(/\/messages\/(\d+)(?:$|\/)/);
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
    const router = useRouter();
    const pathname = usePathname();
    const { currentUser, loggedIn } = useAppContext();
    const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(
        null,
    );
    const incomingCallRef = useRef<CallSignalPayload | null>(null);

    const currentUserId = Number(currentUser?.id ?? 0);
    const currentConversationId = useMemo(
        () => getConversationIdFromPath(pathname),
        [pathname],
    );
    const incomingCallerInfo = incomingCall
        ? getSignalCallerInfo(incomingCall)
        : {};

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    const clearIncoming = useCallback(() => {
        setIncomingCall(null);
        incomingCallRef.current = null;
    }, []);

    const rejectIncomingCall = useCallback(() => {
        const current = incomingCallRef.current;
        if (!current || !currentUserId) return;

        chatWebsocketService.sendCallSignal({
            event: "reject-call",
            conversationId: current.conversationId,
            callId: current.callId,
            callType: current.callType,
            fromUserId: currentUserId,
            targetUserId: current.fromUserId,
        });

        clearIncoming();
    }, [clearIncoming, currentUserId]);

    const openConversation = useCallback(() => {
        const current = incomingCallRef.current;
        if (!current) return;

        setPendingIncomingCall(current);
        clearIncoming();
        router.push({
            pathname: "/(stack)/messages/[conversationId]",
            params: { conversationId: String(current.conversationId) },
        });
    }, [clearIncoming, router]);

    useEffect(() => {
        if (!loggedIn || !Number.isFinite(currentUserId) || !currentUserId) {
            clearIncoming();
            return;
        }

        let disposed = false;
        const onCallEvent = (event: CallSignalPayload) => {
            if (disposed) return;

            if (event.event === "incoming-call" || event.event === "call-user") {
                const activeCall = chatRuntimeStore.getActiveCall();
                if (
                    activeCall &&
                    activeCall.userId === currentUserId &&
                    activeCall.callId !== event.callId
                ) {
                    chatWebsocketService.sendCallSignal({
                        event: "reject-call",
                        conversationId: event.conversationId,
                        callId: event.callId,
                        callType: event.callType,
                        fromUserId: currentUserId,
                        targetUserId: event.fromUserId,
                        candidate: { reason: "busy" },
                    });
                    return;
                }

                if (currentConversationId === event.conversationId) {
                    return;
                }

                setIncomingCall(event);
                incomingCallRef.current = event;
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
            if (!chatWebsocketService.isConnected()) {
                await chatWebsocketService.connect();
            }

            if (disposed) return;
            chatWebsocketService.subscribeToCallEvents(currentUserId, onCallEvent);
        };

        void setup();

        return () => {
            disposed = true;
            chatWebsocketService.unsubscribeFromCallEvents(
                currentUserId,
                onCallEvent,
            );
        };
    }, [clearIncoming, currentConversationId, currentUserId, loggedIn]);

    useEffect(() => {
        if (!incomingCall) return;
        if (currentConversationId !== incomingCall.conversationId) return;
        clearIncoming();
    }, [clearIncoming, currentConversationId, incomingCall]);

    return (
        <IncomingCallOverlay
            visible={Boolean(incomingCall)}
            callerName={
                incomingCallerInfo.callerName ||
                (incomingCall ? `Nguoi dung ${incomingCall.fromUserId}` : "Nguoi dung")
            }
            callType={incomingCall?.callType ?? "audio"}
            onAccept={openConversation}
            onReject={rejectIncomingCall}
        />
    );
}
