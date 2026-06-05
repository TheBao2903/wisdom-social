import { useEffect } from 'react';
import chatWebsocketService from '@/services/chatWebsocketService';

export interface PostRealtimeEvent {
    action: "CREATE" | "UPDATE" | "DELETE" | "BUMP";
    post?: any;
    postId: string;
    authorId: string;
    actorId?: string;  // Who triggered the activity (reactor/commenter)
    lastActivityAt?: string;
}

interface UseRealtimePostsProps {
    topic?: string; // e.g. "/topic/posts" or "/topic/user/{userId}/posts"
    enabled?: boolean;
    onPostCreated?: (post: any) => void;
    onPostUpdated?: (post: any) => void;
    onPostDeleted?: (postId: string) => void;
    onActivityBump?: (postId: string, lastActivityAt: string, actorId?: string) => void;
}

export function useRealtimePosts({
    topic = "/topic/posts",
    enabled = true,
    onPostCreated,
    onPostUpdated,
    onPostDeleted,
    onActivityBump
}: UseRealtimePostsProps) {
    useEffect(() => {
        if (!topic || !enabled) return;

        const handleEvent = (body: string) => {
            try {
                const event = JSON.parse(body) as PostRealtimeEvent;
                console.log('📡 Realtime Post Event:', event);
                const { action, post, postId } = event;

                switch (action) {
                    case "CREATE":
                        if (post && onPostCreated) onPostCreated(post);
                        break;
                    case "UPDATE":
                        if (post && onPostUpdated) onPostUpdated(post);
                        break;
                    case "DELETE":
                        if (onPostDeleted) onPostDeleted(postId);
                        break;
                    case "BUMP":
                        if (postId && event.lastActivityAt && onActivityBump) {
                            onActivityBump(postId, event.lastActivityAt, event.actorId);
                        }
                        break;
                }
            } catch (error) {
                console.error("❌ Error parsing post WebSocket message:", error);
            }
        };

        const setup = async () => {
            try {
                if (!chatWebsocketService.isConnected()) {
                    await chatWebsocketService.connect();
                }
                chatWebsocketService.subscribeToTopic(topic, handleEvent);
            } catch (err) {
                console.error("❌ WebSocket setup failed for posts:", err);
            }
        };

        setup();

        return () => {
            try {
                chatWebsocketService.unsubscribeFromTopic(topic);
            } catch (error) {
                // ignore
            }
        };
    }, [topic, enabled, onPostCreated, onPostUpdated, onPostDeleted, onActivityBump]);
}

export default useRealtimePosts;
