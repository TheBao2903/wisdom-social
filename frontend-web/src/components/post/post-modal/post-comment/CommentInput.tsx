/**
 * 📌 CommentInput Component
 *
 * Responsibility:
 * - Render comment input field with mention support
 * - Handle user search for mentions
 * - Display mention suggestions dropdown
 * - Handle comment submission
 * - Support @mention formatting
 *
 * Why:
 * - Isolates input UI and mention logic from comment tree
 * - Mention autocomplete is complex, keep it separate
 * - Makes comment input independently reusable
 *
 * Props:
 * - commentInput: string
 * - submittingComment: boolean
 * - showMentionDropdown: boolean
 * - mentionUsers: UserData[]
 * - onCommentChange: (e: ChangeEvent) => void
 * - onSelectMention: (user: UserData) => void
 * - onSubmitComment: () => void
 *
 * Side Effects:
 * - onCommentChange handles:
 *   - Mention detection (@)
 *   - User search based on mention query
 *   - Mention dropdown visibility
 *
 * Notes:
 * - Mentions highlighted in blue
 * - Dropdown shows matching users
 * - Submit on Enter (without Shift)
 * - Disabled while submitting
 */

import React from "react";
import { Smile, Send } from "lucide-react";
import { Theme } from "emoji-picker-react";
import IconModal from "../../../icon-modal/IconModal";
import type { UserData } from "../../../../types/post";
import { getAvatarUrl } from "../../../../utils/s3";

interface CommentInputProps {
  commentInput: string;
  submittingComment: boolean;
  showMentionDropdown: boolean;
  mentionUsers: UserData[];
  onCommentChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCursorChange: (cursorPos: number) => void;
  onInsertEmoji: (emoji: string) => void;
  onSelectMention: (user: UserData) => void;
  onSubmitComment: () => void;
  mentionLoading?: boolean;
  mentionHasMore?: boolean;
  onLoadMoreMentions?: () => void;
}

const CommentInput: React.FC<CommentInputProps & { inputRef?: React.RefObject<HTMLInputElement | null> }> = ({
  commentInput,
  submittingComment,
  showMentionDropdown,
  mentionUsers,
  onCommentChange,
  onCursorChange,
  onInsertEmoji,
  onSelectMention,
  onSubmitComment,
  inputRef,
  mentionLoading,
  onLoadMoreMentions,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const emojiButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const handleEmojiClick = (emoji: string) => {
    onInsertEmoji(emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="px-4 py-3 border-t dark:border-[#363636] relative bg-white dark:bg-gray-900">
      {/* Mention Dropdown Suggestions */}
      {showMentionDropdown && (
        <div 
          className="absolute bottom-full left-4 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 max-h-60 overflow-y-auto z-50 w-72 overflow-x-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          onScroll={(e) => {
            const target = e.currentTarget;
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 20) {
              onLoadMoreMentions?.();
            }
          }}
        >
          <div className="p-2 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Gợi ý bạn bè</p>
          </div>
          
          <div className="py-1">
            {mentionUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectMention(user)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors group border-b last:border-none dark:border-gray-700"
              >
                <div className="relative">
                  <img
                    src={getAvatarUrl(user.avatarUrl) || "https://i.pravatar.cc/150?img=5"}
                    alt={user.username}
                    className="w-9 h-9 rounded-full object-cover border dark:border-gray-700 group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold dark:text-white truncate group-hover:text-blue-500">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    @{user.username}
                  </p>
                </div>
              </button>
            ))}

            {mentionLoading && (
              <div className="p-4 flex justify-center items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-500">Đang tải...</span>
              </div>
            )}

            {!mentionLoading && mentionUsers.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Không tìm thấy bạn bè nào</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Container */}
      <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-900/10 p-2 px-3 rounded-xl border border-blue-100/50 dark:border-blue-900/20">
        <div className="relative">
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="p-1 hover:opacity-70 transition-opacity"
            aria-label="Insert emoji"
            title="Insert emoji"
          >
            <Smile size={22} className="text-gray-500 dark:text-gray-400" />
          </button>

          <IconModal
            open={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onEmojiClick={(emojiData) => handleEmojiClick(emojiData.emoji)}
            theme={
              document.documentElement.classList.contains("dark")
                ? Theme.DARK
                : Theme.LIGHT
            }
            anchorRef={emojiButtonRef}
            containerClassName="absolute bottom-full left-0 mb-4 z-50"
            pickerProps={{
              height: 350,
              width: 300,
            }}
          />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={commentInput}
          onChange={onCommentChange}
          onClick={(e) => onCursorChange(e.currentTarget.selectionStart || 0)}
          onKeyUp={(e) => onCursorChange(e.currentTarget.selectionStart || 0)}
          onSelect={(e) =>
            onCursorChange(
              e.currentTarget.selectionStart || commentInput.length
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmitComment();
            }
          }}
          placeholder="Thêm bình luận..."
          className="flex-1 text-sm outline-none bg-transparent dark:text-white caret-blue-500 placeholder-gray-400"
          disabled={submittingComment}
        />

        {/* Submit Button */}
        <button
          onClick={onSubmitComment}
          disabled={!commentInput.trim() || submittingComment}
          className="text-blue-500 hover:text-blue-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center"
          title="Gửi bình luận"
          aria-label="Gửi bình luận"
        >
          {submittingComment ? (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
};

export default CommentInput;
