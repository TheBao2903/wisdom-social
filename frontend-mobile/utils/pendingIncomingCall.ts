import type { CallSignalPayload } from "@/services/chatWebsocketService";

let pendingIncomingCall: CallSignalPayload | null = null;

export function setPendingIncomingCall(call: CallSignalPayload): void {
    pendingIncomingCall = call;
}

export function consumePendingIncomingCall(
    conversationId: number,
): CallSignalPayload | null {
    if (!pendingIncomingCall) return null;
    if (pendingIncomingCall.conversationId !== conversationId) return null;

    const call = pendingIncomingCall;
    pendingIncomingCall = null;
    return call;
}
