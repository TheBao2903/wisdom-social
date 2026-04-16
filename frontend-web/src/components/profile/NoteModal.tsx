import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Trash2,
  MapPin,
  Music,
  Search,
  Smile,
  Play,
  Pause,
} from "lucide-react";
import EmojiPicker, {
  type EmojiClickData,
  type Theme,
} from "emoji-picker-react";
import axiosClient from "../../api/axiosClient";

const MAX_CHARS = 200;

interface MusicTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl60: string;
  previewUrl: string;
}

interface NoteMusic {
  title: string;
  artist: string;
  coverUrl: string;
  previewUrl: string;
}

interface Note {
  id: string;
  userId: string;
  content: string;
  emoji: string;
  location?: string;
  music?: NoteMusic;
  createdAt: string;
  expireAt: string;
}

interface NoteModalProps {
  userId: string;
  isOwnProfile: boolean;
  onClose: () => void;
  onNoteChange?: (note: Note | null) => void;
}

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
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);

  // emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // music search
  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<MusicTrack[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const musicSearchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // audio preview
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const prefillEdit = (n: Note) => {
    setContent(n.content || "");
    setLocation(n.location || "");
    if (n.music) {
      setSelectedMusic({
        trackId: 0,
        trackName: n.music.title,
        artistName: n.music.artist,
        artworkUrl60: n.music.coverUrl,
        previewUrl: n.music.previewUrl,
      });
    } else {
      setSelectedMusic(null);
    }
  };

  // Fetch existing note
  useEffect(() => {
    axiosClient
      .get(`/notes/user/${userId}`)
      .then((res) => {
        const fetched: Note | null = res.data.data;
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

  // Close emoji picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!emojiPickerRef.current?.contains(e.target as Node))
        setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close music search on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!musicSearchRef.current?.contains(e.target as Node))
        setShowMusicSearch(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Stop audio on unmount
  useEffect(
    () => () => {
      audioRef.current?.pause();
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

  // iTunes Search API for music
  const searchMusic = useCallback(async (q: string) => {
    if (!q.trim()) {
      setMusicResults([]);
      return;
    }
    setMusicSearching(true);
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          q
        )}&media=music&limit=10`
      );
      const json = await res.json();
      setMusicResults(
        (json.results as MusicTrack[]).filter((t) => t.previewUrl)
      );
    } catch {
      setMusicResults([]);
    } finally {
      setMusicSearching(false);
    }
  }, []);

  const handleMusicQueryChange = (v: string) => {
    setMusicQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchMusic(v), 400);
  };

  // Audio preview toggle
  const togglePreview = (url: string) => {
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
    } else {
      audioRef.current?.pause();
      const a = new Audio(url);
      a.onended = () => setPlayingUrl(null);
      a.play().catch(() => {});
      audioRef.current = a;
      setPlayingUrl(url);
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
      const body: Record<string, string> = { userId };
      if (content.trim()) body.content = content.trim();
      if (location.trim()) body.location = location.trim();
      if (selectedMusic) {
        body.musicTitle = selectedMusic.trackName;
        body.musicArtist = selectedMusic.artistName;
        body.musicPreviewUrl = selectedMusic.previewUrl;
        body.musicCoverUrl = selectedMusic.artworkUrl60;
      }
      const res = await axiosClient.post("/notes", body);
      const saved: Note = res.data.data;
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
      await axiosClient.delete(`/notes/${note.id}`);
      setNote(null);
      setContent("");
      setLocation("");
      setSelectedMusic(null);
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

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
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
                  className="w-full px-3 py-2.5 text-sm border dark:border-gray-700 rounded-xl resize-none dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pb-8"
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
                    <div
                      ref={emojiPickerRef}
                      className="fixed z-200"
                      style={{ top: pickerPos.top, left: pickerPos.left }}
                    >
                      <EmojiPicker
                        onEmojiClick={(emojiData: EmojiClickData) =>
                          insertEmoji(emojiData.emoji)
                        }
                        theme={"auto" as Theme}
                        lazyLoadEmojis
                        width={350}
                        height={400}
                      />
                    </div>
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

              {/* Location */}
              <div className="flex items-center gap-2 px-3 py-2 border dark:border-gray-700 rounded-xl dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location..."
                  className="flex-1 text-sm bg-transparent dark:text-white focus:outline-none"
                />
                {location && (
                  <button
                    onClick={() => setLocation("")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Music */}
              <div ref={musicSearchRef} className="space-y-2">
                {selectedMusic ? (
                  /* Selected track chip */
                  <div className="flex items-center gap-3 px-3 py-2 border dark:border-gray-700 rounded-xl dark:bg-gray-800">
                    <img
                      src={selectedMusic.artworkUrl60}
                      alt={selectedMusic.trackName}
                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold dark:text-white truncate">
                        {selectedMusic.trackName}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {selectedMusic.artistName}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePreview(selectedMusic.previewUrl)}
                      className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {playingUrl === selectedMusic.previewUrl ? (
                        <Pause className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                      ) : (
                        <Play className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMusic(null);
                        audioRef.current?.pause();
                        setPlayingUrl(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Music search trigger button */
                  <button
                    type="button"
                    onClick={() => setShowMusicSearch((p) => !p)}
                    className="w-full flex items-center gap-2 px-3 py-2 border dark:border-gray-700 rounded-xl dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Music className="w-4 h-4 shrink-0" />
                    <span>Add music...</span>
                  </button>
                )}

                {/* Music search panel */}
                {showMusicSearch && !selectedMusic && (
                  <div className="border dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-800">
                    <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-gray-700">
                      <Search className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={musicQuery}
                        onChange={(e) => handleMusicQueryChange(e.target.value)}
                        placeholder="Search songs, artists..."
                        className="flex-1 text-sm bg-transparent dark:text-white focus:outline-none"
                      />
                      {musicSearching && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {!musicQuery && (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Type to search music
                        </p>
                      )}
                      {musicResults.length === 0 &&
                        musicQuery &&
                        !musicSearching && (
                          <p className="text-xs text-gray-400 text-center py-4">
                            No results
                          </p>
                        )}
                      {musicResults.map((track) => (
                        <button
                          key={track.trackId}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          onClick={() => {
                            setSelectedMusic(track);
                            setShowMusicSearch(false);
                            setMusicQuery("");
                            setMusicResults([]);
                          }}
                        >
                          <img
                            src={track.artworkUrl60}
                            alt={track.trackName}
                            className="w-9 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold dark:text-white truncate">
                              {track.trackName}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {track.artistName}
                            </p>
                          </div>
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePreview(track.previewUrl);
                            }}
                            className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                          >
                            {playingUrl === track.previewUrl ? (
                              <Pause className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                            ) : (
                              <Play className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                            )}
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
              {note.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{note.location}</span>
                </div>
              )}
              {note.music && (
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                  <img
                    src={note.music.coverUrl}
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
                  {note.music.previewUrl && (
                    <button
                      onClick={() => togglePreview(note.music!.previewUrl)}
                      className="p-2 rounded-full bg-white dark:bg-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      {playingUrl === note.music.previewUrl ? (
                        <Pause className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      ) : (
                        <Play className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      )}
                    </button>
                  )}
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
