import { useState, useEffect } from 'react';
import websocketService from '../services/websocket';
import type { ReactionRealtimeEvent } from './useRealtimeReactions';

interface RealtimeCommentEvent {
  action: "CREATE" | "DELETE";
  postId: string;
  payload: any;
}

interface UseRealtimePostStatsProps {
  postId: string;
  initialLikes?: number;
  initialComments?: number;
}

export function useRealtimePostStats({
  postId,
  initialLikes = 0,
  initialComments = 0
}: UseRealtimePostStatsProps) {
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [commentsCount, setCommentsCount] = useState(initialComments);

  useEffect(() => {
    setLikesCount(initialLikes);
  }, [initialLikes]);

  useEffect(() => {
    setCommentsCount(initialComments);
  }, [initialComments]);

  useEffect(() => {
    if (!postId) return;

    const reactionsTopic = `/topic/post/${postId}/reactions`;
    const commentsTopic = `/topic/post/${postId}/comments`;

    const handleReaction = (event: ReactionRealtimeEvent) => {
      if (event.targetType === "POST" && event.targetId === postId) {
        setLikesCount(prev =>
          event.action === "REACT" ? prev + 1 : Math.max(0, prev - 1)
        );
      }
    };

    const handleComment = (event: RealtimeCommentEvent | any) => {
      // Handle both wrapped event and direct comment payload for backward compatibility
      const action = event.action || "CREATE";

      if (action === "CREATE") {
        setCommentsCount(prev => prev + 1);
      } else if (action === "DELETE") {
        setCommentsCount(prev => Math.max(0, prev - 1));
      }
    };

    const setup = async () => {
      try {
        if (!websocketService.isConnected()) {
          await websocketService.connect();
        }
        websocketService.subscribeToTopic(reactionsTopic, handleReaction);
        websocketService.subscribeToTopic(commentsTopic, handleComment);
      } catch (err) {
        console.error(`❌ WebSocket setup failed for post stats ${postId}:`, err);
      }
    };

    setup();

    return () => {
      websocketService.unsubscribeFromTopic(reactionsTopic);
      websocketService.unsubscribeFromTopic(commentsTopic);
    };
  }, [postId]);

  return { likesCount, commentsCount };
}

export default useRealtimePostStats;
