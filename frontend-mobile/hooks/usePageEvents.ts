import { useEffect, useRef, useState } from "react";
import chatWebsocketService from "@/services/chatWebsocketService";
import pageWebsocketService, { type PageEvent } from "@/services/pageWebsocketService";

/**
 * Subscribes to real-time page WebSocket events.
 *
 * - If `pageId` is provided, subscribes to /topic/page/{pageId}/members
 *   (member joins/leaves, join requests — useful for all users on the page detail screen).
 * - If `userId` is provided, subscribes to /topic/user/{userId}/page-events
 *   (personal notifications: request approved/rejected/blocked).
 *
 * Returns `refreshTrigger` — a counter that bumps on every incoming event.
 * Pass it as a useEffect dependency to auto-reload any dependent data.
 */
export function usePageEvents(options: {
    pageId?: number;
    userId?: number;
    onEvent?: (event: PageEvent) => void;
}): number {
    const { pageId, userId } = options;
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const onEventRef = useRef(options.onEvent);
    onEventRef.current = options.onEvent;

    useEffect(() => {
        let cancelled = false;
        let currentHandler: ((event: PageEvent) => void) | null = null;

        const setup = async () => {
            try {
                await chatWebsocketService.connect();
            } catch {
                // connect() may throw if all candidates fail; subscriptions are
                // registered and will be synced on the next reconnect.
            }

            if (cancelled) return;

            const handler = (event: PageEvent) => {
                console.log("📡 [Mobile] Realtime Page Event received:", event.eventType, event);
                setRefreshTrigger((n) => n + 1);
                onEventRef.current?.(event);
            };

            currentHandler = handler;

            if (pageId) {
                pageWebsocketService.subscribeToPageMembers(pageId, handler);
            }
            if (userId) {
                pageWebsocketService.subscribeToUserPageEvents(userId, handler);
            }
        };

        void setup();

        return () => {
            cancelled = true;
            if (pageId && currentHandler) {
                pageWebsocketService.unsubscribeFromPageMembers(pageId, currentHandler);
            }
            if (userId && currentHandler) {
                pageWebsocketService.unsubscribeFromUserPageEvents(userId, currentHandler);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId, userId]);

    return refreshTrigger;
}
