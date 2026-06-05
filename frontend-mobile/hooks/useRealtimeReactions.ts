import { useEffect } from 'react';
import chatWebsocketService from '@/services/chatWebsocketService';

export interface ReactionRealtimeEvent {
  action: "REACT" | "UNREACT";
  rootPostId: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reactionType: string;
  userId: string;
}

interface UseRealtimeReactionsProps {
  postId: string;
  enabled?: boolean;
  onReactionUpdate: (event: ReactionRealtimeEvent) => void;
}

export function useRealtimeReactions({ postId, enabled = true, onReactionUpdate }: UseRealtimeReactionsProps) {
  useEffect(() => {
    if (!postId || !enabled) return;

    const destination = `/topic/post/${postId}/reactions`;

    const handleNewReaction = (body: string) => {
      try {
        const parsed = JSON.parse(body) as ReactionRealtimeEvent;
        console.log('📡 Received realtime reaction event from WebSocket:', parsed);
        onReactionUpdate(parsed);
      } catch (error) {
        console.error("❌ Error parsing reaction WebSocket message:", error);
      }
    };

    const setupWebSocket = async () => {
      try {
        if (!chatWebsocketService.isConnected()) {
          await chatWebsocketService.connect();
        }
        chatWebsocketService.subscribeToTopic(destination, handleNewReaction);
      } catch (error) {
        console.error("❌ Error setting up WebSocket for reactions:", error);
      }
    };

    setupWebSocket();

    return () => {
      try {
        chatWebsocketService.unsubscribeFromTopic(destination);
      } catch (error) {
        // ignore
      }
    };
  }, [postId, enabled, onReactionUpdate]);
}

export default useRealtimeReactions;
