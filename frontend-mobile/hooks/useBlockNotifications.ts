import { useEffect, useRef, useState } from "react";
import type { ApiAuthUser } from "@/services/authService";
import chatWebsocketService from "@/services/chatWebsocketService";
import blockWebsocketService, { type BlockEvent } from "@/services/blockWebsocketService";
import { getUser } from "@/utils/storage";

function toInternationalPhone(phone: string): string {
    if (!phone) return phone;
    if (phone.startsWith("+84")) return phone;
    if (phone.startsWith("0")) return "+84" + phone.substring(1);
    if (/^\d{9,10}$/.test(phone)) return "+84" + phone;
    return phone;
}

/**
 * Subscribes to block/unblock WebSocket events for the current user.
 * Returns a refreshTrigger counter that increments on each event.
 */
export function useBlockNotifications(
    onEvent?: (event: BlockEvent) => void,
): number {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    useEffect(() => {
        let phone: string | null = null;
        let cancelled = false;
        let cleanup: (() => void) | null = null;

        const setup = async () => {
            const storedUser = await getUser<ApiAuthUser>();
            if (cancelled || !storedUser?.phone) return;

            phone = toInternationalPhone(storedUser.phone);

            try {
                await chatWebsocketService.connect();
            } catch {
                // subscriptions will sync on next reconnect
            }

            const handleBlockEvent = (event: BlockEvent) => {
                setRefreshTrigger((n) => n + 1);
                onEventRef.current?.(event);
            };

            blockWebsocketService.subscribeToUserBlockEvents(phone, handleBlockEvent);

            cleanup = () => {
                if (phone) {
                    blockWebsocketService.unsubscribeFromUserBlockEvents(phone, handleBlockEvent);
                }
            };
        };

        void setup();

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, []);

    return refreshTrigger;
}
