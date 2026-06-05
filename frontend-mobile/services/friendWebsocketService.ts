import chatWebsocketService from "@/services/chatWebsocketService";

export type FriendEventType =
    | "friend-request"
    | "friend-accept"
    | "friend-reject"
    | "friend-cancel";

export type FriendEvent = {
    eventType: FriendEventType;
    senderId?: number;
    receiverId?: number;
    timestamp?: string;
};

/**
 * Subscribes to real-time friend events for a user.
 * Reuses the existing ChatWebsocketService STOMP connection.
 *
 * Topics (keyed by phone):
 *   /topic/user/{phone}/friend-request
 *   /topic/user/{phone}/friend-accept
 *   /topic/user/{phone}/friend-reject
 *   /topic/user/{phone}/friend-cancel
 */
class FriendWebsocketService {
    private readonly EVENT_TYPES: FriendEventType[] = [
        "friend-request",
        "friend-accept",
        "friend-reject",
        "friend-cancel",
    ];
    private listenersByPhone = new Map<string, Set<(event: FriendEvent) => void>>();
    private topicHandlersByPhone = new Map<string, Map<FriendEventType, (body: string) => void>>();

    subscribeToUserFriendEvents(
        phone: string,
        onEvent: (event: FriendEvent) => void,
    ): void {
        const listeners = this.listenersByPhone.get(phone) ?? new Set();
        listeners.add(onEvent);
        this.listenersByPhone.set(phone, listeners);

        if (listeners.size > 1) return;

        const topicHandlers = new Map<FriendEventType, (body: string) => void>();
        this.topicHandlersByPhone.set(phone, topicHandlers);

        this.EVENT_TYPES.forEach((eventType) => {
            const destination = `/topic/user/${phone}/${eventType}`;
            const handler = (body: string) => {
                const phoneListeners = this.listenersByPhone.get(phone);
                if (!phoneListeners?.size) return;

                try {
                    const parsed = JSON.parse(body) as FriendEvent;
                    phoneListeners.forEach((listener) =>
                        listener({ ...parsed, eventType }),
                    );
                } catch {
                    phoneListeners.forEach((listener) => listener({ eventType }));
                }
            };
            topicHandlers.set(eventType, handler);
            chatWebsocketService.subscribeToTopic(destination, handler);
        });
    }

    unsubscribeFromUserFriendEvents(
        phone: string,
        onEvent?: (event: FriendEvent) => void,
    ): void {
        const listeners = this.listenersByPhone.get(phone);
        if (listeners && onEvent) {
            listeners.delete(onEvent);
            if (listeners.size > 0) return;
        }

        this.listenersByPhone.delete(phone);
        const topicHandlers = this.topicHandlersByPhone.get(phone);
        this.EVENT_TYPES.forEach((eventType) => {
            const destination = `/topic/user/${phone}/${eventType}`;
            const handler = topicHandlers?.get(eventType);
            if (handler) {
                chatWebsocketService.unsubscribeFromTopic(destination, handler);
            } else {
                chatWebsocketService.unsubscribeFromTopic(destination);
            }
        });
        this.topicHandlersByPhone.delete(phone);
    }
}

const friendWebsocketService = new FriendWebsocketService();
export default friendWebsocketService;
