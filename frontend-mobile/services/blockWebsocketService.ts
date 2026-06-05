import chatWebsocketService from "@/services/chatWebsocketService";

export type BlockEventType = "save-block" | "cancel-block";

export type BlockEvent = {
    eventType: BlockEventType;
    blockerId?: number;
    blockedId?: number;
    timestamp?: string;
};

/**
 * Subscribes to real-time block events for a user.
 * Reuses the existing ChatWebsocketService STOMP connection.
 *
 * Topics (keyed by phone):
 *   /topic/user/{phone}/save-block
 *   /topic/user/{phone}/cancel-block
 */
class BlockWebsocketService {
    private readonly EVENT_TYPES: BlockEventType[] = ["save-block", "cancel-block"];
    private readonly listenersByPhone = new Map<string, Map<(event: BlockEvent) => void, Map<BlockEventType, (body: string) => void>>>();

    subscribeToUserBlockEvents(
        phone: string,
        onEvent: (event: BlockEvent) => void,
    ): void {
        const callbacksByEvent = new Map<BlockEventType, (body: string) => void>();
        const phoneListeners = this.listenersByPhone.get(phone) ?? new Map();
        phoneListeners.set(onEvent, callbacksByEvent);
        this.listenersByPhone.set(phone, phoneListeners);

        this.EVENT_TYPES.forEach((eventType) => {
            const destination = `/topic/user/${phone}/${eventType}`;
            const handler = (body: string) => {
                try {
                    const parsed = JSON.parse(body) as BlockEvent;
                    onEvent({ ...parsed, eventType });
                } catch {
                    onEvent({ eventType });
                }
            };
            callbacksByEvent.set(eventType, handler);
            chatWebsocketService.subscribeToTopic(destination, handler);
        });
    }

    unsubscribeFromUserBlockEvents(phone: string, onEvent?: (event: BlockEvent) => void): void {
        const phoneListeners = this.listenersByPhone.get(phone);
        if (!phoneListeners) return;

        const listenersToRemove = onEvent
            ? ([[onEvent, phoneListeners.get(onEvent)]] as Array<[(event: BlockEvent) => void, Map<BlockEventType, (body: string) => void> | undefined]>)
            : Array.from(phoneListeners.entries());

        listenersToRemove.forEach(([listener, callbacksByEvent]) => {
            if (!callbacksByEvent) return;
            this.EVENT_TYPES.forEach((eventType) => {
                const destination = `/topic/user/${phone}/${eventType}`;
                const handler = callbacksByEvent.get(eventType);
                if (handler) {
                    chatWebsocketService.unsubscribeFromTopic(destination, handler);
                }
            });
            phoneListeners.delete(listener);
        });

        if (phoneListeners.size === 0) {
            this.listenersByPhone.delete(phone);
        }
    }

    unsubscribeAllFromUserBlockEvents(phone: string): void {
        this.EVENT_TYPES.forEach((eventType) => {
            chatWebsocketService.unsubscribeFromTopic(`/topic/user/${phone}/${eventType}`);
        });
        this.listenersByPhone.delete(phone);
    }
}

const blockWebsocketService = new BlockWebsocketService();
export default blockWebsocketService;
