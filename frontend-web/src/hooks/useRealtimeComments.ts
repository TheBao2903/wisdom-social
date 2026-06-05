import { useEffect, useRef } from 'react';
import websocketService from '../services/websocket';
import type { Comment } from '../services/commentService';

interface UseRealtimeCommentsProps {
  postId: string;
  commentsById: Record<string, Comment>;
  createReply: (parentId: string | null, newComment: Comment) => void;
  deleteComment: (commentId: string, parentId?: string) => void;
  viewerId: string;
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
  onCommentReceived,
  onCommentDeleted
}: UseRealtimeCommentsProps) {

  // Use a ref for commentsById to prevent re-subscribing on every comment change
  const commentsByIdRef = useRef(commentsById);

  useEffect(() => {
    commentsByIdRef.current = commentsById;
  }, [commentsById]);

  useEffect(() => {
    if (!postId) return;

    const destination = `/topic/post/${postId}/comments`;

    const handleNewEvent = (event: RealtimeCommentEvent | Comment) => {
      console.log('📡 Received realtime comment event from WebSocket:', event);

      // Backward compatibility if backend sends raw CommentResponse
      const action = (event as RealtimeCommentEvent).action || "CREATE";
      const newComment = (event as RealtimeCommentEvent).payload || (event as Comment);

      if (action === "DELETE") {
        // We trigger delete even if not in commentsById map to clean up rootIds/recentIds
        deleteComment(newComment.id, newComment.parentId || undefined);
        
        if (onCommentDeleted) {
          onCommentDeleted(newComment.id, newComment.parentId || undefined);
        }
        return;
      }

      if (action === "CREATE") {
        // Prevent duplicate if we already have it in the normalized store
        if (commentsByIdRef.current[newComment.id]) {
          return;
        }

        // If we are the ones who created it, our local submit already called createReply optimistically
        if (newComment.userId === viewerId) {
          return;
        }

        // Add to our normalized tree using the existing createReply function
        createReply(newComment.parentId || null, newComment);
        
        // Notify listener
        if (onCommentReceived) {
          onCommentReceived(newComment);
        }
      }
    };

    const setupWebSocket = async () => {
      try {
        if (!websocketService.isConnected()) {
          await websocketService.connect();
        }
        websocketService.subscribeToTopic(destination, handleNewEvent);
      } catch (error) {
        console.error("❌ Error setting up WebSocket for comments:", error);
      }
    };

    setupWebSocket();

    return () => {
      websocketService.unsubscribeFromTopic(destination);
    };
  }, [postId, createReply, deleteComment, viewerId, onCommentReceived]); // commentsById removed from dependencies
}

export default useRealtimeComments;
