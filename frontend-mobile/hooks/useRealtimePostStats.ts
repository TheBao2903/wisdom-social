import { useState, useEffect } from 'react';
import chatWebsocketService from '@/services/chatWebsocketService';
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
  enabled?: boolean;
}

export function useRealtimePostStats({
  postId,
  initialLikes = 0,
  initialComments = 0,
  enabled = true
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
    if (!postId || !enabled) return;

    const reactionsTopic = `/topic/post/${postId}/reactions`;
    const commentsTopic = `/topic/post/${postId}/comments`;

    const handleReaction = (body: string) => {
      try {
        const event = JSON.parse(body) as ReactionRealtimeEvent;
        if (event.targetType === "POST" && event.targetId === postId) {
          setLikesCount(prev =>
            event.action === "REACT" ? prev + 1 : Math.max(0, prev - 1)
          );
        }
      } catch (e) {
        // ignore
      }
    };

    const handleComment = (body: string) => {
      try {
        const event = JSON.parse(body) as RealtimeCommentEvent | any;
        const action = event.action || "CREATE";

        if (action === "CREATE") {
          setCommentsCount(prev => prev + 1);
        } else if (action === "DELETE") {
          setCommentsCount(prev => Math.max(0, prev - 1));
        }
      } catch (e) {
        // ignore
      }
    };

    const setup = async () => {
      try {
        if (!chatWebsocketService.isConnected()) {
          await chatWebsocketService.connect();
        }
        chatWebsocketService.subscribeToTopic(reactionsTopic, handleReaction);
        chatWebsocketService.subscribeToTopic(commentsTopic, handleComment);
      } catch (err) {
        console.error(`❌ WebSocket setup failed for post stats ${postId}:`, err);
      }
    };

    setup();

    return () => {
      try {
        chatWebsocketService.unsubscribeFromTopic(reactionsTopic);
      } catch (error) {
        // ignore
      }
      try {
        chatWebsocketService.unsubscribeFromTopic(commentsTopic);
      } catch (error) {
        // ignore
      }
    };
  }, [postId, enabled]);

  return { likesCount, commentsCount, setLikesCount, setCommentsCount };
}

export default useRealtimePostStats;
