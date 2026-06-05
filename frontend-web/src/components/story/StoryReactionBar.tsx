import React, { useState, useRef } from "react";
import { Send } from "lucide-react";
import { reactToStory } from "../../services/storyService";

interface StoryReactionBarProps {
  storyId: string;
  storyOwnerId: string;
  isMyStory: boolean;
  allowReactions: boolean;
  allowReplies: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export default function StoryReactionBar({
  storyId,
  storyOwnerId: _storyOwnerId,
  isMyStory,
  allowReactions,
  allowReplies,
  onFocus,
  onBlur,
}: StoryReactionBarProps) {
  const [replyText, setReplyText] = useState("");
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [showEmojiPop, setShowEmojiPop] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Don't render anything if this is the owner's story or both features are disabled
  if (isMyStory || (!allowReactions && !allowReplies)) return null;

  const handleReaction = async (emoji: string) => {
    if (isReacting) return;
    setIsReacting(true);
    setShowEmojiPop(emoji);

    try {
      await reactToStory(storyId, emoji);
      setReactedEmoji(emoji);
    } catch (err) {
      console.error("Failed to react to story:", err);
    } finally {
      setIsReacting(false);
      // Clear the pop animation after it finishes
      setTimeout(() => setShowEmojiPop(null), 800);
    }
  };

  const handleReplySubmit = () => {
    // TODO: Implement reply functionality
    if (!replyText.trim()) return;
    console.log("[StoryReply] Reply submitted (not implemented):", replyText);
    setReplyText("");
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleReplySubmit();
    }
  };

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes emojiPopUp {
          0% { transform: scale(0.3) translateY(0); opacity: 0; }
          30% { transform: scale(1.4) translateY(-20px); opacity: 1; }
          60% { transform: scale(1.0) translateY(-40px); opacity: 1; }
          100% { transform: scale(0.6) translateY(-70px); opacity: 0; }
        }
        @keyframes emojiPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .emoji-pop-anim {
          animation: emojiPopUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          pointer-events: none;
        }
        .emoji-reacted {
          animation: emojiPulse 0.3s ease-out;
        }
      `}</style>

      {/* Bottom bar container */}
      <div
        className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-4 px-3"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Quick emoji reactions */}
        {allowReactions && (
          <div className="flex items-center justify-center gap-2 mb-3 relative">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                disabled={isReacting}
                className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer
                  ${reactedEmoji === emoji
                    ? "bg-white/20 ring-2 ring-white/40 scale-110"
                    : "bg-white/10 hover:bg-white/20 hover:scale-110 active:scale-95"
                  }
                `}
                title={`React ${emoji}`}
              >
                <span className={`text-xl ${reactedEmoji === emoji ? "emoji-reacted" : ""}`}>
                  {emoji}
                </span>

                {/* Pop-up animation */}
                {showEmojiPop === emoji && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl emoji-pop-anim">
                    {emoji}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Reply input */}
        {allowReplies && (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder="Trả lời tin..."
                className="w-full bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2.5 text-white text-xs placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/25 focus:bg-white/15 transition-all duration-200"
              />
            </div>
            <button
              onClick={handleReplySubmit}
              disabled={!replyText.trim()}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer
                ${replyText.trim()
                  ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 active:scale-95"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
                }
              `}
              title="Gửi trả lời"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
