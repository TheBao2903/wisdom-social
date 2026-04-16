import  { createContext, useContext, useState, useCallback, useEffect } from "react";
import type  {ReactNode} from "react";
import friendService from "../services/friendService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { User } from "../types";

interface FriendDataContextType {
    // Friend requests received
    friendRequests: User[];
    friendRequestsLoading: boolean;
    friendRequestsError: string;
    refreshFriendRequests: () => Promise<void>;
    
    // Sent requests (requests we sent to others)
    sentRequests: User[];
    sentRequestsLoading: boolean;
    sentRequestsError: string;
    refreshSentRequests: () => Promise<void>;
    
    // Friends list
    friends: User[];
    friendsLoading: boolean;
    friendsError: string;
    refreshFriends: () => Promise<void>;
    
    // Actions
    acceptRequest: (userId: number) => Promise<boolean>;
    rejectRequest: (userId: number) => Promise<boolean>;
    unfriend: (userId: number) => Promise<boolean>;
    
    // Refresh trigger (incremented when WebSocket notification received)
    refreshTrigger: number;
    triggerRefreshAll: () => void;
    
    // Check if all initial data has loaded
    isInitialLoadComplete: boolean;
}

const FriendDataContext = createContext<FriendDataContextType | null>(null);

export function FriendDataProvider({ children }: { children: ReactNode }) {
    const currentUser = useCurrentUser();
    
    // Friend requests state
    const [friendRequests, setFriendRequests] = useState<User[]>([]);
    const [friendRequestsLoading, setFriendRequestsLoading] = useState(true);
    const [friendRequestsError, setFriendRequestsError] = useState("");
    
    // Sent requests state (requests we sent to others)
    const [sentRequests, setSentRequests] = useState<User[]>([]);
    const [sentRequestsLoading, setSentRequestsLoading] = useState(true);
    const [sentRequestsError, setSentRequestsError] = useState("");
    
    // Friends list state
    const [friends, setFriends] = useState<User[]>([]);
    const [friendsLoading, setFriendsLoading] = useState(true);
    const [friendsError, setFriendsError] = useState("");
    
    // Refresh trigger - components can watch this to know when to refresh
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Load friend requests (received)
    const refreshFriendRequests = useCallback(async () => {
        if (!currentUser?.id) {
            console.log("⚠️  Cannot refresh friend requests: no currentUser.id");
            return;
        }

        setFriendRequestsLoading(true);
        setFriendRequestsError("");
        try {
            console.log("🔄 Refreshing friend requests for user:", currentUser.id);
            const requests = await friendService.getFriendRequests(currentUser.id);
            console.log("✅ Friend requests loaded:", requests?.length || 0, "requests");
            setFriendRequests(requests || []);
            console.log(`✅ Loaded ${requests?.length || 0} friend requests`);
        } catch (err: any) {
            console.error("❌ Error loading friend requests:", err);
            setFriendRequestsError("Không thể tải danh sách lời mời kết bạn");
        } finally {
            setFriendRequestsLoading(false);
        }
    }, [currentUser?.id]);

    // Load sent requests (requests we sent to others)
    const refreshSentRequests = useCallback(async () => {
        if (!currentUser?.id) return;
        
        setSentRequestsLoading(true);
        setSentRequestsError("");
        try {
            console.log("🔄 Refreshing sent requests...");
            const requests = await friendService.getSentRequests(currentUser.id);
            setSentRequests(requests || []);
            console.log(`✅ Loaded ${requests?.length || 0} sent requests`);
        } catch (err: any) {
            console.error("Error loading sent requests:", err);
            setSentRequestsError("Không thể tải danh sách lời mời đã gửi");
        } finally {
            setSentRequestsLoading(false);
        }
    }, [currentUser?.id]);

    // Load friends list
    const refreshFriends = useCallback(async () => {
        if (!currentUser?.id) return;
        
        setFriendsLoading(true);
        setFriendsError("");
        try {
            console.log("🔄 Refreshing friends list...");
            const friendsList = await friendService.getFriends(currentUser.id);
            setFriends(friendsList || []);
            console.log(`✅ Loaded ${friendsList?.length || 0} friends`);
        } catch (err: any) {
            console.error("Error loading friends:", err);
            setFriendsError("Không thể tải danh sách bạn bè");
        } finally {
            setFriendsLoading(false);
        }
    }, [currentUser?.id]);
    
    // Trigger refresh for all subscribers (used after WebSocket notifications)
    const triggerRefreshAll = useCallback(() => {
        console.log("🔄 Triggering refresh for all friend data...");
        setRefreshTrigger(prev => prev + 1);
        refreshFriendRequests();
        refreshSentRequests();
        refreshFriends();
    }, [refreshFriendRequests, refreshSentRequests, refreshFriends]);
    
    // Check if all initial data has loaded
    const isInitialLoadComplete = !friendsLoading && !friendRequestsLoading && !sentRequestsLoading;

    // Initial load
    useEffect(() => {
        if (currentUser?.id) {
            refreshFriendRequests();
            refreshSentRequests();
            refreshFriends();
        }
    }, [currentUser?.id, refreshFriendRequests, refreshSentRequests, refreshFriends]);

    // Accept friend request
    const acceptRequest = useCallback(async (userId: number): Promise<boolean> => {
        if (!currentUser?.id) return false;
        
        try {
            await friendService.acceptFriendRequest({
                senderId: userId,
                receivedId: currentUser.id,
            });
            // Update local state immediately
            setFriendRequests(prev => prev.filter(u => u.id !== userId));
            // Refresh friends list to show new friend
            refreshFriends();
            return true;
        } catch (err) {
            console.error("Error accepting request:", err);
            return false;
        }
    }, [currentUser?.id, refreshFriends]);

    // Reject friend request
    const rejectRequest = useCallback(async (userId: number): Promise<boolean> => {
        if (!currentUser?.id) return false;
        
        try {
            await friendService.rejectFriendRequest({
                senderId: userId,
                receivedId: currentUser.id,
            });
            // Update local state immediately
            setFriendRequests(prev => prev.filter(u => u.id !== userId));
            return true;
        } catch (err) {
            console.error("Error rejecting request:", err);
            return false;
        }
    }, [currentUser?.id]);

    // Unfriend
    const unfriend = useCallback(async (userId: number): Promise<boolean> => {
        if (!currentUser?.id) return false;
        
        try {
            await friendService.cancelFriendRequest({
                senderId: currentUser.id,
                receivedId: userId,
            });
            // Update local state immediately
            setFriends(prev => prev.filter(u => u.id !== userId));
            return true;
        } catch (err) {
            console.error("Error unfriending:", err);
            return false;
        }
    }, [currentUser?.id]);

    return (
        <FriendDataContext.Provider value={{
            friendRequests,
            friendRequestsLoading,
            friendRequestsError,
            refreshFriendRequests,
            sentRequests,
            sentRequestsLoading,
            sentRequestsError,
            refreshSentRequests,
            friends,
            friendsLoading,
            friendsError,
            refreshFriends,
            acceptRequest,
            rejectRequest,
            unfriend,
            refreshTrigger,
            triggerRefreshAll,
            isInitialLoadComplete,
        }}>
            {children}
        </FriendDataContext.Provider>
    );
}

export function useFriendData() {
    const context = useContext(FriendDataContext);
    if (!context) {
        throw new Error("useFriendData must be used within FriendDataProvider");
    }
    return context;
}

// Safe version that returns default values if not within provider
export function useFriendDataSafe() {
    const context = useContext(FriendDataContext);
    if (!context) {
        return {
            friendRequests: [] as User[],
            friendRequestsLoading: true, // Default to true so useFriendStatus waits
            friendRequestsError: "",
            refreshFriendRequests: async () => {},
            sentRequests: [] as User[],
            sentRequestsLoading: true, // Default to true so useFriendStatus waits
            sentRequestsError: "",
            refreshSentRequests: async () => {},
            friends: [] as User[],
            friendsLoading: true, // Default to true so useFriendStatus waits
            friendsError: "",
            refreshFriends: async () => {},
            acceptRequest: async () => false,
            rejectRequest: async () => false,
            unfriend: async () => false,
            refreshTrigger: 0,
            triggerRefreshAll: () => {},
            isInitialLoadComplete: false,
        };
    }
    return context;
}

// Export the context itself for advanced usage
export { FriendDataContext };

export default FriendDataProvider;
