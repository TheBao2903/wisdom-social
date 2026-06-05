import React from "react";
import EmojiPicker, {
  type EmojiClickData,
  type Theme,
} from "emoji-picker-react";

type PickerProps = Omit<
  React.ComponentProps<typeof EmojiPicker>,
  "onEmojiClick" | "theme"
>;

interface IconModalProps {
  open: boolean;
  onClose: () => void;
  onEmojiClick: (emojiData: EmojiClickData) => void;
  theme?: Theme;
  anchorRef?: React.RefObject<HTMLElement | null>;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  pickerProps?: PickerProps;
}

export default function IconModal({
  open,
  onClose,
  onEmojiClick,
  theme,
  anchorRef,
  containerClassName,
  containerStyle,
  pickerProps,
}: IconModalProps) {
  const modalRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (modalRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={modalRef}
      className={containerClassName}
      style={containerStyle}
      data-icon-modal="true"
    >
      <EmojiPicker onEmojiClick={onEmojiClick} theme={theme} {...pickerProps} />
    </div>
  );
}
