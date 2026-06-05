import { useEffect, useRef } from 'react';
import chatWebsocketService from '@/services/chatWebsocketService';
import type { Comment } from '@/services/commentService';


interface UseRealtimeCommentsProps {
  postId: string;
  commentsById: Record<string, Comment>;
  createReply: (parentId: string | null, newComment: Comment) => void;
  deleteComment: (commentId: string, parentId?: string) => void;
  viewerId: string;
  enabled?: boolean;
  onCommentReceived?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string, parentId?: string) => void;
}

interface RealtimeCommentEvent {
  action: "CREATE" | "DELETE";
  postId: string;
  payload: Comment;
}

export function useRealtimeComments({
  postId,
  commentsById,
  createReply,
  deleteComment,
  viewerId,
  enabled = true,
  onCommentReceived,
  onCommentDeleted
}: UseRealtimeCommentsProps) {

  const commentsByIdRef = useRef(commentsById);

  useEffect(() => {
    commentsByIdRef.current = commentsById;
  }, [commentsById]);

  useEffect(() => {
    if (!postId || !enabled) return;

    const destination = `/topic/post/${postId}/comments`;

    const handleNewEvent = (body: string) => {
      try {
        const event = JSON.parse(body) as RealtimeCommentEvent | Comment;
        console.log('📡 Received realtime comment event from WebSocket:', event);

        const action = (event as RealtimeCommentEvent).action || "CREATE";
        const newComment = (event as RealtimeCommentEvent).payload || (event as Comment);

        if (action === "DELETE") {
          deleteComment(newComment.id, newComment.parentId || undefined);
          
          if (onCommentDeleted) {
            onCommentDeleted(newComment.id, newComment.parentId || undefined);
          }
          return;
        }

        if (action === "CREATE") {
          if (commentsByIdRef.current[newComment.id]) {
            return;
          }

          if (newComment.userId === viewerId) {
            return;
          }

          createReply(newComment.parentId || null, newComment);
          
          if (onCommentReceived) {
            onCommentReceived(newComment);
          }
        }
      } catch (error) {
        console.error("❌ Error parsing comments WebSocket event:", error);
      }
    };

    const setupWebSocket = async () => {
      try {
        if (!chatWebsocketService.isConnected()) {
          await chatWebsocketService.connect();
        }
        chatWebsocketService.subscribeToTopic(destination, handleNewEvent);
      } catch (error) {
        console.error("❌ Error setting up WebSocket for comments:", error);
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
  }, [postId, enabled, createReply, deleteComment, viewerId, onCommentReceived, onCommentDeleted]);
}

export default useRealtimeComments;
