import { useEffect } from 'react';
import websocketService from '../services/websocket';

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
  onReactionUpdate: (event: ReactionRealtimeEvent) => void;
}

export function useRealtimeReactions({ postId, onReactionUpdate }: UseRealtimeReactionsProps) {
  useEffect(() => {
    if (!postId) return;

    const destination = `/topic/post/${postId}/reactions`;

    const handleNewReaction = (event: ReactionRealtimeEvent) => {
      console.log('📡 Received realtime reaction event from WebSocket:', event);
      onReactionUpdate(event);
    };

    const setupWebSocket = async () => {
      try {
        if (!websocketService.isConnected()) {
          await websocketService.connect();
        }
        websocketService.subscribeToTopic(destination, handleNewReaction);
      } catch (error) {
        console.error("❌ Error setting up WebSocket for reactions:", error);
      }
    };

    setupWebSocket();

    return () => {
      websocketService.unsubscribeFromTopic(destination);
    };
  }, [postId, onReactionUpdate]);
}

export default useRealtimeReactions;
