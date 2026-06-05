import { useEffect, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import websocketService from "../services/websocket";

function toInternationalPhone(phone: string): string {
    if (!phone) return phone;
    if (phone.startsWith("+84")) return phone;
    if (phone.startsWith("0")) return "+84" + phone.substring(1);
    if (/^\d{9,10}$/.test(phone)) return "+84" + phone;
    return phone;
}

const BLOCK_EVENT_TYPES = ["save-block", "cancel-block"] as const;

/**
 * Subscribes to block/unblock WebSocket events for the current user.
 * Returns a refreshTrigger counter that increments on each event.
 * Mirrors mobile's useBlockNotifications hook.
 */
export function useBlockNotifications(): number {
    const currentUser = useCurrentUser();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (!currentUser?.phone) return;

        const phone = toInternationalPhone(currentUser.phone);

        const setup = async () => {
            try {
                await websocketService.connect();
                BLOCK_EVENT_TYPES.forEach((eventType) => {
                    websocketService.subscribeToTopic(
                        `/topic/user/${phone}/${eventType}`,
                        handleBlockEvent,
                    );
                });
            } catch {
                // subscriptions will sync on next reconnect
            }
        };

        const handleBlockEvent = (payload?: {
            eventType?: string;
            blockerId?: number | string;
            blockedId?: number | string;
        }) => {
            setRefreshTrigger((n) => n + 1);

            const blockerId = Number(payload?.blockerId);
            const blockedId = Number(payload?.blockedId);
            if (!Number.isFinite(blockerId) || !Number.isFinite(blockedId)) {
                return;
            }

            window.dispatchEvent(
                new CustomEvent("user-block-status-changed", {
                    detail: {
                        blockerId,
                        blockedId,
                        blocked: payload?.eventType === "save-block",
                    },
                }),
            );
        };

        void setup();

        return () => {
            BLOCK_EVENT_TYPES.forEach((eventType) => {
                websocketService.unsubscribeFromTopic(`/topic/user/${phone}/${eventType}`, handleBlockEvent);
            });
        };
    }, [currentUser?.phone]);

    return refreshTrigger;
}

export default useBlockNotifications;
