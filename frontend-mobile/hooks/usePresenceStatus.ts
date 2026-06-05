import { useAppContext } from "@/context/AppContext";
import chatWebsocketService from "@/services/chatWebsocketService";
import presenceService, { UserPresenceStatus } from "@/services/presenceService";
import { useEffect, useMemo, useState } from "react";

type PresenceMap = Record<number, UserPresenceStatus>;

export function usePresenceStatus(
    userIds: Array<number | string | null | undefined>,
): PresenceMap {
    const { currentUser } = useAppContext();
    const [statuses, setStatuses] = useState<PresenceMap>({});
    const idsKey = userIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .sort((a, b) => a - b)
        .join(",");
    const normalizedIds = useMemo(
        () =>
            Array.from(
                new Set(
                    idsKey
                        .split(",")
                        .map((id) => Number(id))
                        .filter((id) => Number.isFinite(id) && id > 0),
                ),
            ),
        [idsKey],
    );
    const currentUserId = Number(currentUser?.id);

    useEffect(() => {
        if (!Number.isFinite(currentUserId) || currentUserId <= 0) return;
        if (normalizedIds.length === 0) return;

        let cancelled = false;

        const fetchInitialPresence = async () => {
            if (cancelled) return;
            try {
                const items = await presenceService.getBulkStatus(normalizedIds);
                if (cancelled) return;
                setStatuses((prev) => {
                    const next = { ...prev };
                    items.forEach((item) => {
                        next[item.userId] = item;
                    });
                    return next;
                });
            } catch {
                // REST chi lay snapshot ban dau; realtime WebSocket van tiep tuc cap nhat.
            }
        };

        void fetchInitialPresence();

        return () => {
            cancelled = true;
        };
    }, [currentUserId, idsKey]);

    useEffect(() => {
        if (!Number.isFinite(currentUserId) || currentUserId <= 0) return;

        const handlePresenceEvent = (event: UserPresenceStatus) => {
            setStatuses((prev) => ({
                ...prev,
                [event.userId]: event,
            }));
        };

        const setupPresence = async () => {
            try {
                await chatWebsocketService.connect();
                chatWebsocketService.subscribeToPresence(
                    currentUserId,
                    handlePresenceEvent,
                );
            } catch {
                // Presence la lop bo sung, khong chan cac man hinh chat/profile.
            }
        };

        void setupPresence();

        return () => {
            chatWebsocketService.unsubscribeFromPresence(
                currentUserId,
                handlePresenceEvent,
            );
        };
    }, [currentUserId]);

    return statuses;
}
