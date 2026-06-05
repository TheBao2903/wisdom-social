import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Image,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants";
import { noteService, SaveNoteRequest } from "@/services/noteService";
import type { Note } from "@/types";
import {
  playAudioPreview,
  stopAudioPreview,
  resolveMusicMediaUrl,
} from "@/services/musicService";
import type { MusicMetadata } from "@/services/musicService";
import StoryMusicPickerModal from "./story/StoryMusicPickerModal";
import apiClient from "@/api/apiClient";
import { buildS3Url } from "@/utils/s3";

const MAX_CHARS = 200;

interface NoteModalProps {
  visible: boolean;
  userId: string;
  isOwnProfile: boolean;
  onClose: () => void;
  onNoteChange?: (note: Note | null) => void;
}

export default function NoteModal({
  visible,
  userId,
  isOwnProfile,
  onClose,
  onNoteChange,
}: NoteModalProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [selectedMusic, setSelectedMusic] = useState<MusicMetadata | null>(
    null
  );

  // Audio preview
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [isMusicSelectorOpen, setIsMusicSelectorOpen] = useState(false);
  const [noteFullMusicData, setNoteFullMusicData] = useState<MusicMetadata | null>(null);

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

  // Fetch existing note and its full music data
  useEffect(() => {
    if (!visible) {
      stopAudioPreview().catch(console.error);
      setPlayingUrl(null);
      setNoteFullMusicData(null);
      return;
    }

    setLoading(true);
    noteService
      .getNoteByUserId(userId)
      .then(async (fetched) => {
        setNote(fetched);
        if (fetched) {
          prefillEdit(fetched);
          setIsEditing(false);
          // Fetch full music data if note has music
          if (fetched.music?.trackId) {
            try {
              const response = await apiClient.get(`/music/${fetched.music.trackId}`);
              const musicData = response.data?.data ?? response.data;
              if (musicData) {
                setNoteFullMusicData({
                  id: String(musicData.id || musicData.trackId || ""),
                  title: musicData.title || fetched.music.title || "",
                  artist: musicData.artist || fetched.music.artist || "",
                  duration: Number(musicData.duration || fetched.music.duration || 0),
                  imageUrl: buildS3Url(musicData.imageUrl || musicData.coverUrl || fetched.music.coverUrl || fetched.music.thumbnail) || musicData.imageUrl || fetched.music.coverUrl || fetched.music.thumbnail || "",
                  audioUrl: buildS3Url(musicData.audioUrl) || musicData.audioUrl || fetched.music.audioUrl || "",
                  createdAt: musicData.createdAt,
                });
              }
            } catch {
              // Fall back to note.music data
              setNoteFullMusicData(mapNoteMusicToSelectedMusic(fetched));
            }
          } else {
            setNoteFullMusicData(null);
          }
        } else if (isOwnProfile) {
          setIsEditing(true);
          setContent("");
          setLocation("");
          setSelectedMusic(null);
          setNoteFullMusicData(null);
        }
      })
      .catch(() => {
        setNote(null);
        setNoteFullMusicData(null);
      })
      .finally(() => setLoading(false));

    return () => {
      void stopAudioPreview();
      setPlayingUrl(null);
    };
  }, [visible, userId, isOwnProfile]);

  // Play note music if present in view mode
  useEffect(() => {
    if (loading || isEditing || !visible) return;

    const noteAudioUrl = noteFullMusicData?.audioUrl
      ? resolveMusicMediaUrl(noteFullMusicData.audioUrl)
      : null;
    if (noteAudioUrl) {
      void stopAudioPreview();
      void playAudioPreview(noteAudioUrl, {
        onEnded: () => setPlayingUrl(null),
      });
      setPlayingUrl(noteAudioUrl);
    }

    return () => {
      void stopAudioPreview();
      setPlayingUrl(null);
    };
  }, [loading, isEditing, noteFullMusicData, visible]);

  const startPreview = async (url: string) => {
    if (!url) return;
    await stopAudioPreview();
    await playAudioPreview(url, {
      onEnded: () => setPlayingUrl(null),
    });
    setPlayingUrl(url);
  };

  const togglePreview = async (url: string) => {
    if (!url) return;
    if (playingUrl === url) {
      await stopAudioPreview();
      setPlayingUrl(null);
    } else {
      await startPreview(url);
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
      const payload: SaveNoteRequest = {
        userId,
        content: content.trim() || undefined,
        location: location.trim() || undefined,
        trackId: selectedMusic?.id || undefined,
        musicTitle: selectedMusic?.title || undefined,
        musicArtist: selectedMusic?.artist || undefined,
        musicPreviewUrl: selectedMusic?.audioUrl || undefined,
        musicCoverUrl: selectedMusic?.imageUrl || undefined,
      };
      const saved = await noteService.saveNote(payload);
      setNote(saved);
      setIsEditing(false);
      onNoteChange?.(saved);
      onClose();
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
      await noteService.deleteNoteById(note.id);
      setNote(null);
      setContent("");
      setLocation("");
      setSelectedMusic(null);
      void stopAudioPreview();
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
    if (diff <= 0) return "Đã hết hạn";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `Còn ${h}g ${m}ph` : `Còn ${m}ph`;
  };

  const noteAudioUrl = noteFullMusicData?.audioUrl
    ? resolveMusicMediaUrl(noteFullMusicData.audioUrl)
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            Keyboard.dismiss();
          }}
        />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isOwnProfile
                ? isEditing
                  ? note
                    ? "Sửa ghi chú"
                    : "Tạo ghi chú"
                  : "Ghi chú của bạn"
                : "Ghi chú"}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.body}>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : isEditing ? (
              /* ══ EDIT MODE ══ */
              <View style={styles.editContainer}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={content}
                    onChangeText={(text) =>
                      setContent(text.slice(0, MAX_CHARS))
                    }
                    placeholder="Bạn đang nghĩ gì? (không bắt buộc)"
                    placeholderTextColor={colors.textMuted}
                    style={styles.textInput}
                    multiline
                    numberOfLines={4}
                    autoFocus
                  />
                  <Text
                    style={[
                      styles.charCounter,
                      content.length >= MAX_CHARS && styles.charCounterLimit,
                    ]}
                  >
                    {content.length}/{MAX_CHARS}
                  </Text>
                </View>

                {/* Music picker row */}
                <View style={styles.sectionRow}>
                  <Ionicons
                    name="musical-notes"
                    size={20}
                    color={colors.primary}
                  />
                  {selectedMusic ? (
                    <View style={styles.musicPreviewRow}>
                      <Image
                        source={{ uri: selectedMusic.imageUrl }}
                        style={styles.musicCover}
                      />
                      <View style={styles.musicMeta}>
                        <Text style={styles.musicTitle} numberOfLines={1}>
                          {selectedMusic.title}
                        </Text>
                        <Text style={styles.musicArtist} numberOfLines={1}>
                          {selectedMusic.artist}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          togglePreview(
                            resolveMusicMediaUrl(selectedMusic.audioUrl) || ""
                          )
                        }
                        style={styles.playMusicBtn}
                      >
                        <Ionicons
                          name={
                            playingUrl ===
                            resolveMusicMediaUrl(selectedMusic.audioUrl)
                              ? "pause"
                              : "play"
                          }
                          size={16}
                          color={colors.text}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedMusic(null);
                          void stopAudioPreview();
                          setPlayingUrl(null);
                        }}
                        style={styles.clearMusicBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.pickerPlaceholder}
                      onPress={() => setIsMusicSelectorOpen(true)}
                    >
                      <Text style={styles.placeholderText}>
                        Thêm nhạc vào ghi chú...
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Location input row */}
                <View style={styles.sectionRow}>
                  <Ionicons name="location" size={20} color="#ED4956" />
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Thêm vị trí..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.locationInput}
                  />
                  {location ? (
                    <TouchableOpacity
                      onPress={() => setLocation("")}
                      style={styles.clearLocationBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.expiryNote}>
                  ⏱ Ghi chú sẽ tự động biến mất sau 24 giờ.
                </Text>
              </View>
            ) : note ? (
              /* ══ VIEW MODE ══ */
              <View style={styles.viewContainer}>
                {note.content ? (
                  <View style={styles.noteBubbleCard}>
                    <Text style={styles.noteBubbleText}>{note.content}</Text>
                  </View>
                ) : null}

                {note.music ? (
                  <View style={styles.musicDisplayCard}>
                    {noteFullMusicData?.imageUrl ? (
                      <Image
                        source={{ uri: noteFullMusicData.imageUrl }}
                        style={styles.musicCoverBig}
                      />
                    ) : (
                      <View style={styles.musicCoverFallback}>
                        <Ionicons
                          name="musical-notes"
                          size={24}
                          color={colors.white}
                        />
                      </View>
                    )}
                    <View style={styles.musicMetaBig}>
                      <Text style={styles.musicTitleBig} numberOfLines={1}>
                        {note.music.title}
                      </Text>
                      <Text style={styles.musicArtistBig} numberOfLines={1}>
                        {note.music.artist}
                      </Text>
                    </View>
                    {noteFullMusicData?.audioUrl ? (
                      <TouchableOpacity
                        onPress={() => togglePreview(noteAudioUrl || "")}
                        style={styles.playMusicBigBtn}
                      >
                        <Ionicons
                          name={playingUrl === noteAudioUrl ? "pause" : "play"}
                          size={20}
                          color={colors.white}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {note.location?.trim() ? (
                  <View style={styles.locationDisplayRow}>
                    <Ionicons name="location" size={16} color="#ED4956" />
                    <Text style={styles.locationDisplayText}>
                      {note.location.trim()}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.timeLeftText}>
                  ⏱ {getTimeLeft(note.expireAt)}
                </Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Chưa có ghi chú nào được đăng
              </Text>
            )}
          </View>

          {/* Footer */}
          {!loading && (
            <View style={styles.footer}>
              {isEditing ? (
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleCancelEdit}
                  >
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.shareBtn,
                      !canSave && styles.shareBtnDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={saving || !canSave}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.shareBtnText}>Chia sẻ</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : isOwnProfile && note ? (
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={handleDelete}
                    disabled={saving}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.danger}
                    />
                    <Text style={styles.deleteBtnText}>Xóa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={handleEditClick}
                  >
                    <Text style={styles.editBtnText}>Chỉnh sửa</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {/* Music Picker Modal */}
      <StoryMusicPickerModal
        visible={isMusicSelectorOpen}
        onClose={() => setIsMusicSelectorOpen(false)}
        onSelect={(music) => {
          setSelectedMusic(music);
          void stopAudioPreview();
          setPlayingUrl(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  body: {
    paddingVertical: spacing.lg,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  editContainer: {
    gap: spacing.md,
  },
  inputWrapper: {
    position: "relative",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  textInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: "top",
    paddingBottom: spacing.lg,
  },
  charCounter: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 11,
    color: colors.textMuted,
  },
  charCounterLimit: {
    color: colors.danger,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 52,
    backgroundColor: colors.surface,
  },
  pickerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    height: "100%",
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  musicPreviewRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  musicCover: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  musicMeta: {
    flex: 1,
    justifyContent: "center",
  },
  musicTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  musicArtist: {
    fontSize: 11,
    color: colors.textMuted,
  },
  playMusicBtn: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  clearMusicBtn: {
    padding: spacing.sm,
  },
  locationInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    height: "100%",
  },
  clearLocationBtn: {
    padding: spacing.xs,
  },
  expiryNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  viewContainer: {
    alignItems: "stretch",
    gap: spacing.md,
  },
  noteBubbleCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteBubbleText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  musicDisplayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  musicCoverBig: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  musicCoverFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  musicMetaBig: {
    flex: 1,
  },
  musicTitleBig: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  musicArtistBig: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  playMusicBigBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  locationDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  locationDisplayText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  timeLeftText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  footer: {
    marginTop: spacing.sm,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  shareBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnDisabled: {
    opacity: 0.5,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
});
