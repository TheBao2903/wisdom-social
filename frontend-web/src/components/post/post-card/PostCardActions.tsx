import { MessageCircle, Bookmark, Heart } from "lucide-react";

interface PostCardActionsProps {
  currentReaction: string | null;
  isLiked: boolean;
  showReactions: boolean;
  isSaved: boolean;
  likesCount: number;
  onLike: (e: React.MouseEvent) => void;
  onComment: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  onReaction: (reactionType: string, e: React.MouseEvent) => void;
  onReactionMouseEnter: () => void;
  onReactionMouseLeave: () => void;
  onShare?: (e: React.MouseEvent) => void;
  allowComments?: boolean;
  allowShares?: boolean;
}

const REACTIONS = [
  { type: "LIKE", emoji: "👍", title: "Like" },
  { type: "LOVE", emoji: "❤️", title: "Love" },
  { type: "HAHA", emoji: "😂", title: "Haha" },
  { type: "WOW", emoji: "😮", title: "Wow" },
  { type: "SAD", emoji: "😢", title: "Sad" },
  { type: "ANGRY", emoji: "😡", title: "Angry" },
];

export default function PostCardActions({
  currentReaction,
  isLiked: _isLiked,
  showReactions,
  isSaved,
  likesCount,
  onLike,
  onComment,
  onSave,
  onReaction,
  onReactionMouseEnter,
  onReactionMouseLeave,
  onShare,
  allowComments = true,
  allowShares = true,
}: PostCardActionsProps) {
  return (
    <>
      <div className="flex items-center justify-between pt-1 pb-2">
        <div className="flex items-center gap-4">
          <div
            className="relative"
            onMouseEnter={onReactionMouseEnter}
            onMouseLeave={onReactionMouseLeave}
          >
            <button
              onClick={onLike}
              className="hover:opacity-50 transition-opacity"
            >
              {REACTIONS.filter((r) => r.type === currentReaction).map(
                (reaction) => (
                  <span key={reaction.type} className="text-2xl">
                    {reaction.emoji}
                  </span>
                )
              )}
              {!currentReaction && <Heart size={27} strokeWidth={1.8} />}
            </button>

            {showReactions && (
              <div
                className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 rounded-full shadow-2xl border dark:border-gray-700 px-4 py-3 flex gap-2 z-50"
                onMouseEnter={onReactionMouseEnter}
                onMouseLeave={onReactionMouseLeave}
              >
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    onClick={(e) => onReaction(reaction.type, e)}
                    className="hover:scale-125 transition-transform text-3xl"
                    title={reaction.title}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          {allowComments !== false && (
            <button
              onClick={onComment}
              className="hover:opacity-50 transition-opacity"
            >
              <MessageCircle size={27} strokeWidth={1.8} />
            </button>
          )}
          {allowShares !== false && (
            <button
              onClick={onShare}
              className="hover:opacity-50 transition-opacity"
            >
              <svg
                width="27"
                height="27"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={onSave}
          className="hover:opacity-50 transition-opacity"
        >
          <Bookmark
            size={26}
            fill={isSaved ? "currentColor" : "none"}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <button className="text-sm font-semibold mb-2 hover:opacity-50 block dark:text-white">
        {likesCount.toLocaleString()} {likesCount !== 1 ? "likes" : "like"}
      </button>
    </>
  );
}
