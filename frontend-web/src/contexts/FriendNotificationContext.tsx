import  { createContext, useContext, useRef, useEffect } from "react";
import type  {ReactNode} from "react";
import { useFriendNotifications, type FriendNotificationPayload } from "../hooks/useFriendNotifications";
import { useFriendDataSafe } from "./FriendDataContext";

interface FriendNotificationContextType {
    currentUserPhone?: string;
    isConnected: boolean;
}

const FriendNotificationContext = createContext<FriendNotificationContextType>({
    isConnected: false,
});

interface FriendNotificationProviderProps {
    children: ReactNode;
    onFriendRequest?: (payload: FriendNotificationPayload) => void;
    onFriendAccept?: (payload: FriendNotificationPayload) => void;
    onFriendReject?: (payload: FriendNotificationPayload) => void;
    onFriendCancel?: (payload: FriendNotificationPayload) => void;
}

export function FriendNotificationProvider({
    children,
    onFriendRequest,
    onFriendAccept,
    onFriendReject,
    onFriendCancel,
}: FriendNotificationProviderProps) {
    // Get trigger refresh function from FriendData context
    const { triggerRefreshAll } = useFriendDataSafe();

    // Use refs to always have the latest callbacks
    const callbacksRef = useRef({
        onFriendRequest,
        onFriendAccept,
        onFriendReject,
        onFriendCancel,
    });

    // Update refs when callbacks change
    useEffect(() => {
        callbacksRef.current = {
            onFriendRequest,
            onFriendAccept,
            onFriendReject,
            onFriendCancel,
        };
    }, [onFriendRequest, onFriendAccept, onFriendReject, onFriendCancel]);

    // Wrapper callbacks that use refs and trigger refresh
    const handleFriendRequest = (payload: FriendNotificationPayload) => {
        console.log("🔔 FriendNotificationProvider: onFriendRequest triggered", payload);
        callbacksRef.current.onFriendRequest?.(payload);
        console.log("🔄 Calling triggerRefreshAll()...");
        triggerRefreshAll(); // Refresh friend data
        console.log("✅ triggerRefreshAll() called");
    };

    const handleFriendAccept = (payload: FriendNotificationPayload) => {
        console.log("🔔 FriendNotificationProvider: onFriendAccept triggered", payload);
        callbacksRef.current.onFriendAccept?.(payload);
        console.log("🔄 Calling triggerRefreshAll()...");
        triggerRefreshAll(); // Refresh friend data
        console.log("✅ triggerRefreshAll() called");
    };

    const handleFriendReject = (payload: FriendNotificationPayload) => {
        console.log("🔔 FriendNotificationProvider: onFriendReject triggered", payload);
        callbacksRef.current.onFriendReject?.(payload);
        console.log("🔄 Calling triggerRefreshAll()...");
        triggerRefreshAll(); // Refresh friend data
        console.log("✅ triggerRefreshAll() called");
    };

    const handleFriendCancel = (payload: FriendNotificationPayload) => {
        console.log("🔔 FriendNotificationProvider: onFriendCancel triggered", payload);
        callbacksRef.current.onFriendCancel?.(payload);
        console.log("🔄 Calling triggerRefreshAll()...");
        triggerRefreshAll(); // Refresh friend data
        console.log("✅ triggerRefreshAll() called");
    };

    const { currentUserPhone, isConnected } = useFriendNotifications({
        onFriendRequest: handleFriendRequest,
        onFriendAccept: handleFriendAccept,
        onFriendReject: handleFriendReject,
        onFriendCancel: handleFriendCancel,
        showToasts: true,
    });

    return (
        <FriendNotificationContext.Provider value={{ currentUserPhone, isConnected }}>
            {children}
        </FriendNotificationContext.Provider>
    );
}

export function useFriendNotificationContext() {
    return useContext(FriendNotificationContext);
}

export default FriendNotificationProvider;
