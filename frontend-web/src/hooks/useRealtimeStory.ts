import { useEffect } from 'react';
import websocketService from '../services/websocket';

export interface StoryRealtimeEvent {
  type: "STORY_VIEW" | "STORY_REACTION";
  storyId: string;
  data?: {
    viewCount?: number;
    viewer?: any;
    reaction?: string;
  };
}

interface UseRealtimeStoryProps {
  storyId: string;
  enabled?: boolean;
  onStoryUpdate: (event: StoryRealtimeEvent) => void;
}

export function useRealtimeStory({ storyId, enabled = true, onStoryUpdate }: UseRealtimeStoryProps) {
  useEffect(() => {
    if (!storyId || !enabled) return;

    const destination = `/topic/stories/${storyId}`;

    const handleStoryUpdate = (event: StoryRealtimeEvent) => {
      console.log('📡 Received realtime story event from WebSocket:', event);
      onStoryUpdate(event);
    };

    const setupWebSocket = async () => {
      try {
        if (!websocketService.isConnected()) {
          await websocketService.connect();
        }
        websocketService.subscribeToTopic(destination, handleStoryUpdate);
      } catch (error) {
        console.error("❌ Error setting up WebSocket for story:", error);
      }
    };

    setupWebSocket();

    return () => {
      websocketService.unsubscribeFromTopic(destination);
    };
  }, [storyId, enabled, onStoryUpdate]);
}

export default useRealtimeStory;
