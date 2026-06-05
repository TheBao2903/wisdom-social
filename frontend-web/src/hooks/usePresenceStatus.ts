import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import presenceService, { type UserPresenceStatus } from "../services/presenceService";
import websocketService from "../services/websocket";

type PresenceMap = Record<number, UserPresenceStatus>;

export function usePresenceStatus(userIds: Array<number | string | null | undefined>): PresenceMap {
    const { currentUser } = useAuth();
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

    useEffect(() => {
        if (normalizedIds.length === 0) return;

        let cancelled = false;
        presenceService
            .getBulkStatus(normalizedIds)
            .then((items) => {
                if (cancelled) return;
                setStatuses((prev) => {
                    const next = { ...prev };
                    items.forEach((item) => {
                        next[item.userId] = item;
                    });
                    return next;
                });
            })
            .catch((error) => {
                // REST chi lay snapshot ban dau; neu loi thi realtime WebSocket van tiep tuc cap nhat.
                console.error("Khong the tai trang thai presence ban dau:", error);
            });

        return () => {
            cancelled = true;
        };
    }, [idsKey]);

    useEffect(() => {
        if (!currentUser?.id) return;

        const handlePresenceEvent = (event: UserPresenceStatus) => {
            setStatuses((prev) => ({
                ...prev,
                [event.userId]: event,
            }));
        };

        const setupPresence = async () => {
            try {
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }
                websocketService.subscribeToPresence(currentUser.id, handlePresenceEvent);
            } catch (error) {
                console.error("Khong the lang nghe presence realtime:", error);
            }
        };

        void setupPresence();

        return () => {
            websocketService.unsubscribeFromPresence(currentUser.id, handlePresenceEvent);
        };
    }, [currentUser?.id]);

    return statuses;
}
