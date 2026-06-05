/**
 * 📌 PostActions Component
 *
 * Responsibility:
 * - Display reaction button with emoji picker
 * - Display save/bookmark button
 * - Show reaction count
 * - Handle reaction toggles and save toggles
 *
 * Why:
 * - Isolates action UI from PostModal
 * - Centralizes reaction picker logic
 * - Makes action handlers independent
 *
 * Props:
 * - currentReaction: string | null
 * - reactCount: number
 * - isSaved: boolean
 * - showReactions: boolean
 * - setShowReactions: (bool) => void
 * - onReaction: (type: string) => void
 * - onSave: () => void
 *
 * Side Effects:
 * - useRef: reactionsTimeoutRef for hover delays
 * - Mouse events: Show/hide reaction picker with delay
 *
 * Notes:
 * - Reaction picker appears on hover/click
 * - 300ms delay before hiding picker on mouse leave
 * - Bookmark icon fills when saved
 */

import React from "react";
import { Bookmark, Send, Heart } from "lucide-react";

interface PostActionsProps {
  currentReaction: string | null;
  reactCount: number;
  isSaved: boolean;
  showReactions: boolean;
  setShowReactions: (show: boolean) => void;
  onReaction: (type: string) => void;
  onSave: () => void;
  onShare?: () => void;
  reactionsTimeoutRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  allowShares?: boolean;
}

const REACTION_TYPES = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"] as const;

const REACTION_EMOJI: Record<string, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  HAHA: "😂",
  WOW: "😮",
  SAD: "😢",
  ANGRY: "😡",
};

const PostActions: React.FC<PostActionsProps> = ({
  currentReaction,
  reactCount,
  isSaved,
  showReactions,
  setShowReactions,
  onReaction,
  onSave,
  onShare,
  reactionsTimeoutRef,
  allowShares,
}) => {
  const handleMouseEnter = () => {
    if (reactionsTimeoutRef.current) {
      clearTimeout(reactionsTimeoutRef.current);
    }
    setShowReactions(true);
  };

  const handleMouseLeave = () => {
    reactionsTimeoutRef.current = setTimeout(() => {
      setShowReactions(false);
    }, 300);
  };

  return (
    <>
      {/* Action Buttons */}
      <div className="border-t dark:border-[#363636]">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex gap-4">
            {/* Reaction Button with Picker */}
            <div
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => {
                  // Like button should always toggle LIKE specifically
                  onReaction("LIKE");
                }}
                className="hover:scale-110 transition-transform"
              >
                {currentReaction ? (
                  <span className="text-2xl">
                    {REACTION_EMOJI[currentReaction] || "👍"}
                  </span>
                ) : (
                  <Heart
                    size={24}
                    strokeWidth={1.8}
                    className="dark:text-white"
                  />
                )}
              </button>

              {/* Reaction Picker */}
              {showReactions && (
                <div className="absolute bottom-full left-0 mb-0 pb-2 bg-white dark:bg-[#262626] rounded-full shadow-2xl border dark:border-[#363636] px-4 py-3 flex gap-2 z-50 animate-in fade-in zoom-in duration-200">
                  {REACTION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReaction(type);
                      }}
                      className="hover:scale-125 transition-transform text-3xl"
                      title={type}
                    >
                      {REACTION_EMOJI[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send/Share Button */}
            {allowShares !== false && (
              <button
                onClick={onShare}
                className="hover:opacity-70 transition-opacity"
              >
                <Send className="w-6 h-6 dark:text-white" />
              </button>
            )}
          </div>

          {/* Save/Bookmark Button */}
          <button
            onClick={onSave}
            className="hover:opacity-70 transition-opacity"
          >
            <Bookmark
              className={`w-6 h-6 dark:text-white ${
                isSaved ? "fill-black dark:fill-white" : ""
              }`}
            />
          </button>
        </div>

        {/* Reaction Count */}
        <div className="px-4 pb-2">
          <p className="font-bold text-sm dark:text-white">
            {reactCount.toLocaleString()} lượt thích
          </p>
        </div>
      </div>
    </>
  );
};

export default PostActions;
