import { useEffect } from 'react';
import chatWebsocketService from '@/services/chatWebsocketService';

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

    const handleStoryUpdate = (body: string) => {
      try {
        const parsed = JSON.parse(body) as StoryRealtimeEvent;
        console.log('📡 Received realtime story event from WebSocket:', parsed);
        onStoryUpdate(parsed);
      } catch (error) {
        console.error("❌ Error parsing WebSocket message for story:", error);
      }
    };

    const setupWebSocket = async () => {
      try {
        if (!chatWebsocketService.isConnected()) {
          await chatWebsocketService.connect();
        }
        chatWebsocketService.subscribeToTopic(destination, handleStoryUpdate);
      } catch (error) {
        console.error("❌ Error setting up WebSocket for story:", error);
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
  }, [storyId, enabled, onStoryUpdate]);
}

export default useRealtimeStory;
