/**
 * Global reaction event system for cross-component synchronization.
 * When user reacts/unreacts anywhere, all PostCard instances update together.
 */

export type ReactionActionType = "REACT" | "UNREACT" | "TOGGLE";

export interface GlobalReactionEvent {
  action: ReactionActionType;
  postId: string;
  reactionType: string;
  userId: string;
  isToggleOff: boolean;
  likesCount: number;
}

// Simple in-memory event emitter
type ReactionListener = (event: GlobalReactionEvent) => void;

const listeners: Set<ReactionListener> = new Set();

export function emitReactionEvent(event: GlobalReactionEvent) {
  console.log(`[reactionEventService] EMIT event:`, event);
  listeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.error(`[reactionEventService] Listener error:`, e);
    }
  });
}

export function subscribeReactionEvents(listener: ReactionListener): () => void {
  console.log(`[reactionEventService] Subscribe, total listeners: ${listeners.size + 1}`);
  listeners.add(listener);
  return () => {
    console.log(`[reactionEventService] Unsubscribe, remaining: ${listeners.size - 1}`);
    listeners.delete(listener);
  };
}