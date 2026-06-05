import chatWebsocketService from "@/services/chatWebsocketService";

export type PostEvent = {
  action: "CREATE" | "UPDATE" | "DELETE" | "BUMP";
  post?: any;
  postId: string;
  authorId: string;
  lastActivityAt?: string;
};

export type ReactionEvent = {
  action: "REACT" | "UNREACT";
  targetType: "POST" | "COMMENT";
  targetId: string;
  userId: string;
  type?: string;
};

export type CommentEvent = {
  action: "CREATE" | "DELETE";
  postId: string;
  payload?: any;
};

class PostWebsocketService {
  private globalFeedListeners = new Set<(event: PostEvent) => void>();
  private userFeedListeners = new Map<string, Set<(event: PostEvent) => void>>();
  private reactionListeners = new Map<string, Set<(event: ReactionEvent) => void>>();
  private commentListeners = new Map<string, Set<(event: CommentEvent) => void>>();

  // Global Feed
  subscribeToGlobalFeed(onEvent: (event: PostEvent) => void): void {
    this.globalFeedListeners.add(onEvent);
    if (this.globalFeedListeners.size === 1) {
      chatWebsocketService.subscribeToTopic("/topic/posts", (body) => {
        try {
          const parsed = JSON.parse(body) as PostEvent;
          this.globalFeedListeners.forEach((cb) => cb(parsed));
        } catch (e) {
          // Ignore parse errors
        }
      });
    }
  }

  unsubscribeFromGlobalFeed(onEvent: (event: PostEvent) => void): void {
    this.globalFeedListeners.delete(onEvent);
    if (this.globalFeedListeners.size === 0) {
      chatWebsocketService.unsubscribeFromTopic("/topic/posts");
    }
  }

  // User Feed
  subscribeToUserFeed(userId: string, onEvent: (event: PostEvent) => void): void {
    const listeners = this.userFeedListeners.get(userId) || new Set();
    listeners.add(onEvent);
    this.userFeedListeners.set(userId, listeners);

    if (listeners.size === 1) {
      chatWebsocketService.subscribeToTopic(`/topic/user/${userId}/posts`, (body) => {
        try {
          const parsed = JSON.parse(body) as PostEvent;
          const cbs = this.userFeedListeners.get(userId);
          cbs?.forEach((cb) => cb(parsed));
        } catch (e) {
          // Ignore parse errors
        }
      });
    }
  }

  unsubscribeFromUserFeed(userId: string, onEvent: (event: PostEvent) => void): void {
    const listeners = this.userFeedListeners.get(userId);
    if (listeners) {
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        this.userFeedListeners.delete(userId);
        chatWebsocketService.unsubscribeFromTopic(`/topic/user/${userId}/posts`);
      }
    }
  }

  // Post Reactions
  subscribeToPostReactions(postId: string, onEvent: (event: ReactionEvent) => void): void {
    const listeners = this.reactionListeners.get(postId) || new Set();
    listeners.add(onEvent);
    this.reactionListeners.set(postId, listeners);

    if (listeners.size === 1) {
      chatWebsocketService.subscribeToTopic(`/topic/post/${postId}/reactions`, (body) => {
        try {
          const parsed = JSON.parse(body) as ReactionEvent;
          const cbs = this.reactionListeners.get(postId);
          cbs?.forEach((cb) => cb(parsed));
        } catch (e) {
          // Ignore parse errors
        }
      });
    }
  }

  unsubscribeFromPostReactions(postId: string, onEvent: (event: ReactionEvent) => void): void {
    const listeners = this.reactionListeners.get(postId);
    if (listeners) {
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        this.reactionListeners.delete(postId);
        chatWebsocketService.unsubscribeFromTopic(`/topic/post/${postId}/reactions`);
      }
    }
  }

  // Post Comments
  subscribeToPostComments(postId: string, onEvent: (event: CommentEvent) => void): void {
    const listeners = this.commentListeners.get(postId) || new Set();
    listeners.add(onEvent);
    this.commentListeners.set(postId, listeners);

    if (listeners.size === 1) {
      chatWebsocketService.subscribeToTopic(`/topic/post/${postId}/comments`, (body) => {
        try {
          const parsed = JSON.parse(body) as CommentEvent;
          const cbs = this.commentListeners.get(postId);
          cbs?.forEach((cb) => cb(parsed));
        } catch (e) {
          // Ignore parse errors
        }
      });
    }
  }

  unsubscribeFromPostComments(postId: string, onEvent: (event: CommentEvent) => void): void {
    const listeners = this.commentListeners.get(postId);
    if (listeners) {
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        this.commentListeners.delete(postId);
        chatWebsocketService.unsubscribeFromTopic(`/topic/post/${postId}/comments`);
      }
    }
  }
}

const postWebsocketService = new PostWebsocketService();
export default postWebsocketService;
