import { useState, useEffect, useRef } from "react";
import { X, Trash2, MapPin, Smile, Play, Pause } from "lucide-react";
import { Theme } from "emoji-picker-react";
import {
  playAudioPreview,
  resolveMusicMediaUrl,
  stopAudioPreview,
  subscribeToPlayback,
  type MusicMetadata,
} from "../../../services/musicService";
import {
  buildSaveNoteRequest,
  deleteNoteById,
  getNoteByUserId,
  saveNote,
} from "../../../services/noteService";
import type { Note, NoteModalProps } from "../../../types/note";
import IconModal from "../../icon-modal/IconModal";
import NoteMusicPicker from "./NoteMusicPicker";
import NoteLocationField from "./NoteLocationField";

const MAX_CHARS = 200;

export default function NoteModal({
  userId,
  isOwnProfile,
  onClose,
  onNoteChange,
}: NoteModalProps) {
  // data state
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // edit fields
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [selectedMusic, setSelectedMusic] = useState<MusicMetadata | null>(
    null
  );

  // emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // audio preview
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [_isMusicSelectorOpen, setIsMusicSelectorOpen] = useState(false);

  const mapNoteMusicToSelectedMusic = (
    currentNote: Note
  ): MusicMetadata | null => {
    if (!currentNote.music) return null;

    const coverKey =
      currentNote.music.coverUrl || currentNote.music.thumbnail || "";

    return {
      id: currentNote.music.trackId || "",
      title: currentNote.music.title || "",
      artist: currentNote.music.artist || "",
      duration: currentNote.music.duration || 0,
      imageUrl: coverKey,
      audioUrl: currentNote.music.audioUrl || "",
      createdAt: currentNote.createdAt || new Date().toISOString(),
    };
  };

  const prefillEdit = (n: Note) => {
    setContent(n.content || "");
    setLocation(n.location || "");
    setSelectedMusic(mapNoteMusicToSelectedMusic(n));
  };

  // Fetch existing note
  useEffect(() => {
    getNoteByUserId(userId)
      .then((fetched) => {
        setNote(fetched);
        if (fetched) prefillEdit(fetched);
      })
      .catch(() => setNote(null))
      .finally(() => setLoading(false));
  }, [userId]);

  // Auto-enter edit mode when own profile has no note
  useEffect(() => {
    if (!loading && isOwnProfile && !note) setIsEditing(true);
  }, [loading, isOwnProfile, note]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isEditing]);

  // Sync with global playback state
  useEffect(() => {
    return subscribeToPlayback((url) => {
      setPlayingUrl(url);
    });
  }, []);

  // Stop audio on unmount
  useEffect(
    () => () => {
      stopAudioPreview();
    },
    []
  );

  // Insert emoji at textarea cursor position
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const next = (content.slice(0, start) + emoji + content.slice(end)).slice(
      0,
      MAX_CHARS
    );
    setContent(next);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  // Audio preview toggle
  const startPreview = (url: string) => {
    if (!url) return;

    stopAudioPreview();
    const a = playAudioPreview(url, {
      onEnded: () => setPlayingUrl(null),
    });
    if (!a) return;
    audioRef.current = a;
    setPlayingUrl(url);
  };

  const togglePreview = (url: string) => {
    if (!url) return;

    if (playingUrl === url) {
      stopAudioPreview();
      setPlayingUrl(null);
    } else {
      startPreview(url);
    }
  };

  const canSave =
    content.trim().length > 0 ||
    location.trim().length > 0 ||
    selectedMusic !== null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = buildSaveNoteRequest(
        userId,
        content,
        location,
        selectedMusic
      );
      const saved = await saveNote(payload);
      setNote(saved);
      setIsEditing(false);
      onNoteChange?.(saved);
    } catch (err) {
      console.error("Failed to save note", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    setSaving(true);
    try {
      await deleteNoteById(note.id);
      setNote(null);
      setContent("");
      setLocation("");
      setSelectedMusic(null);
      stopAudioPreview();
      setPlayingUrl(null);
      setIsEditing(false);
      onNoteChange?.(null);
      onClose();
    } catch (err) {
      console.error("Failed to delete note", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = () => {
    if (note) prefillEdit(note);
    setIsEditing(true);
  };
  const handleCancelEdit = () => {
    if (!note) {
      onClose();
      return;
    }
    prefillEdit(note);
    setIsEditing(false);
  };

  const getTimeLeft = (expireAt: string) => {
    const diff = new Date(expireAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  };

  const noteCoverUrl = resolveMusicMediaUrl(
    note?.music?.coverUrl || note?.music?.thumbnail
  );
  const noteAudioUrl = resolveMusicMediaUrl(note?.music?.audioUrl);

  // Auto-play note music whenever modal opens in view mode.
  useEffect(() => {
    if (loading || isEditing || !noteAudioUrl) return;
    startPreview(noteAudioUrl);
  }, [loading, isEditing, noteAudioUrl]);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">
            {isOwnProfile
              ? isEditing
                ? note
                  ? "Edit note"
                  : "Add note"
                : "Your note"
              : "Note"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isEditing ? (
            /* ══ EDIT FORM ══ */
            <div className="space-y-4">
              {/* Textarea with inline emoji button */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) =>
                    setContent(e.target.value.slice(0, MAX_CHARS))
                  }
                  placeholder="What's on your mind? (optional)"
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm border dark:border-gray-700 rounded-md resize-none dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pb-8"
                />

                {/* Emoji insert button — bottom left inside textarea */}
                <div className="absolute bottom-2.5 left-2">
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={() => {
                      const rect =
                        emojiButtonRef.current?.getBoundingClientRect();
                      if (rect) {
                        setPickerPos({ top: rect.bottom + 8, left: rect.left });
                      }
                      setShowEmojiPicker((p) => !p);
                    }}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Insert emoji into text"
                  >
                    <Smile className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                  </button>

                  {showEmojiPicker && (
                    <IconModal
                      open={showEmojiPicker}
                      onClose={() => setShowEmojiPicker(false)}
                      onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
                      theme={Theme.AUTO}
                      anchorRef={emojiButtonRef}
                      containerClassName="fixed z-200"
                      containerStyle={{
                        top: pickerPos.top,
                        left: pickerPos.left,
                      }}
                      pickerProps={{
                        lazyLoadEmojis: true,
                        width: 350,
                        height: 400,
                      }}
                    />
                  )}
                </div>

                {/* Char counter — bottom right */}
                <span
                  className={`absolute bottom-3 right-3 text-[11px] tabular-nums pointer-events-none ${
                    content.length >= MAX_CHARS
                      ? "text-red-500"
                      : content.length >= MAX_CHARS * 0.8
                      ? "text-yellow-500"
                      : "text-gray-400"
                  }`}
                >
                  {content.length}/{MAX_CHARS}
                </span>
              </div>

              {/* Music */}
              <NoteMusicPicker
                selectedMusic={selectedMusic}
                playingUrl={playingUrl}
                onTogglePreview={togglePreview}
                onOpenSelector={() => setIsMusicSelectorOpen(true)}
                onCloseSelector={() => {
                  setIsMusicSelectorOpen(false);
                  // Auto-resume note music when selector closes
                  const audioUrl = resolveMusicMediaUrl(selectedMusic?.audioUrl);
                  if (audioUrl) startPreview(audioUrl);
                }}
                onClearSelection={() => {
                  setSelectedMusic(null);
                  stopAudioPreview();
                  setPlayingUrl(null);
                }}
                onSelectMusic={(music) => {
                  setSelectedMusic(music);
                  startPreview(resolveMusicMediaUrl(music.audioUrl));
                }}
              />

              {/* Location */}
              <NoteLocationField
                location={location}
                onChangeLocation={setLocation}
                onClearLocation={() => setLocation("")}
              />

              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                ⏱ Note disappears after 24 hours
              </p>
            </div>
          ) : note ? (
            /* ══ VIEW MODE ══ */
            <div className="space-y-3">
              {note.content && (
                <div className="bg-linear-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/30">
                  <p className="text-sm dark:text-white leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              )}
              {note.music && (
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                  <img
                    src={noteCoverUrl}
                    alt={note.music.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold dark:text-white truncate">
                      {note.music.title}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {note.music.artist}
                    </p>
                  </div>
                  {noteAudioUrl && (
                    <button
                      onClick={() => togglePreview(noteAudioUrl)}
                      className="p-2 rounded-full bg-white dark:bg-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="Play music"
                    >
                      {playingUrl === noteAudioUrl ? (
                        <Pause className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      ) : (
                        <Play className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      )}
                    </button>
                  )}
                </div>
              )}
              {note.location?.trim() && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{note.location.trim()}</span>
                </div>
              )}
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-right">
                ⏱ {getTimeLeft(note.expireAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No note yet
            </p>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-5 pb-5 pt-1">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Share"
                  )}
                </button>
              </div>
            ) : isOwnProfile && note ? (
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleEditClick}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                >
                  Edit note
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
