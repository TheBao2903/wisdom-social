package iuh.fit.edu.backend.controller;

import iuh.fit.edu.backend.constant.StatusType;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.domain.entity.nosql.Music;
import iuh.fit.edu.backend.domain.entity.nosql.MusicMetadata;
import iuh.fit.edu.backend.domain.entity.nosql.Note;
import iuh.fit.edu.backend.dto.response.ApiResponse;
import iuh.fit.edu.backend.repository.nosql.MusicMetadataRepository;
import iuh.fit.edu.backend.repository.nosql.NoteRepository;
import iuh.fit.edu.backend.service.note.NotePermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/*
 * @description: Note management controller
 * Notes are auto-deleted after 24 hours via MongoDB TTL index
 * Only note owner and their friends can view notes
 */
@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
@Slf4j
public class NoteController {

    private final NoteRepository noteRepository;
    private final MusicMetadataRepository musicMetadataRepository;
    private final NotePermissionService permissionService;

    /**
     * Get the current (most recent) note for a user.
     * Only the note owner or their friends can view it.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<Note>> getNoteByUser(@PathVariable String userId) {
        try {
            Long noteOwnerId = Long.parseLong(userId);
            Long requesterId = getCurrentUserId();

            if (requesterId == null) {
                return ResponseEntity.status(403)
                        .body(ApiResponse.error(403, "Unauthorized - no authentication", null));
            }

            // Check permission
            if (!permissionService.canViewNote(noteOwnerId, requesterId)) {
                return ResponseEntity.status(403)
                        .body(ApiResponse.error(403, "Forbidden - you cannot view this note", null));
            }

            List<Note> notes = noteRepository.findByUserIdOrderByCreatedAtDesc(userId);
            Note current = notes.isEmpty() ? null : notes.get(0);
            return ResponseEntity.ok(ApiResponse.success(200, "OK", current));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Invalid userId format", null));
        }
    }

    /**
     * Create or replace the note for the current user.
     * Body: { content, emoji, location, musicTitle, musicArtist, musicCoverUrl }
     * - Authenticated user only
     * - Deletes all existing notes for the user first (only 1 active note per user).
     * - Sets expireAt = now + 24h so MongoDB TTL removes it automatically.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Note>> createNote(@RequestBody Map<String, String> body) {
        Long currentUserId = getCurrentUserId();
        if (currentUserId == null) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error(401, "Unauthorized - authentication required", null));
        }

        String content = body.get("content");
        String location = body.get("location");
        
        // Music can be provided by trackId (reference to MusicMetadata) or manual input
        String trackId = body.get("trackId");
        String startTimeStr = body.get("startTime");
        Integer startTime = null;
        if (startTimeStr != null && !startTimeStr.isBlank()) {
            try {
                startTime = Integer.parseInt(startTimeStr);
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(400, "startTime must be a number (seconds)", null));
            }
        }
        
        String musicTitle      = body.get("musicTitle");
        String musicArtist     = body.get("musicArtist");
        String musicCoverUrl   = body.get("musicCoverUrl");

        // At least one of content / location / music must be present
        boolean hasContent  = content != null && !content.isBlank();
        boolean hasLocation = location != null && !location.isBlank();
        boolean hasTrackId  = trackId != null && !trackId.isBlank();
        boolean hasMusic    = hasTrackId || (musicTitle != null && !musicTitle.isBlank());
        if (!hasContent && !hasLocation && !hasMusic) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Note must have at least text, location, or music", null));
        }
        if (hasContent && content.length() > 200) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Note content must be 200 characters or less", null));
        }

        // Build music sub-object if present
        Music noteMusic = null;
        if (hasTrackId) {
            // Option 1: Use trackId to reference MusicMetadata
            Optional<MusicMetadata> musicMetadata = musicMetadataRepository.findById(trackId);
            if (musicMetadata.isPresent()) {
                MusicMetadata metadata = musicMetadata.get();
                noteMusic = Music.builder()
                        .trackId(trackId)
                        .startTime(startTime)
                        .title(metadata.getTitle())
                        .artist(metadata.getArtist())
                        .thumbnail(metadata.getImageUrl())
                        .audioUrl(metadata.getAudioUrl())
                        .build();
                log.info("Created music from MusicMetadata: {}", trackId);
            } else {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(400, "Music track not found: " + trackId, null));
            }
        } else if (musicTitle != null && !musicTitle.isBlank()) {
            // Option 2: Manual input (fallback)
            noteMusic = Music.builder()
                    .title(musicTitle)
                    .artist(musicArtist != null ? musicArtist : "")
                    .thumbnail(musicCoverUrl != null ? musicCoverUrl : "")
                    .build();
        }

        // Delete all previous notes for this user
        List<Note> existing = noteRepository.findByUserIdOrderByCreatedAtDesc(currentUserId.toString());
        if (!existing.isEmpty()) {
            noteRepository.deleteAll(existing);
        }

        Instant now = Instant.now();
        Note note = Note.builder()
                .userId(currentUserId.toString())
                .content(hasContent ? content.trim() : "")
                .location(hasLocation ? location.trim() : null)
                .music(noteMusic)
                .status(StatusType.ACTIVE)
                .createdAt(now)
                .expireAt(now.plusSeconds(86400))
                .build();

        Note saved = noteRepository.save(note);
        log.info("Note created for user {}: {}", currentUserId, saved.getId());
        return ResponseEntity.ok(ApiResponse.success(201, "Note created", saved));
    }

    /**
     * Update note for the current user.
     * Only owner can update their note.
     * Body: { content, emoji, location, musicTitle, musicArtist, musicCoverUrl }
     */
    @PutMapping("/{noteId}")
    public ResponseEntity<ApiResponse<Note>> updateNote(
            @PathVariable String noteId,
            @RequestBody Map<String, String> body) {
        Long currentUserId = getCurrentUserId();
        if (currentUserId == null) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error(401, "Unauthorized - authentication required", null));
        }

        Optional<Note> optionalNote = noteRepository.findById(noteId);
        if (optionalNote.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(404, "Note not found", null));
        }

        Note note = optionalNote.get();
        Long noteOwnerId = Long.parseLong(note.getUserId());

        // Check if user is owner
        if (!permissionService.canEditNote(noteOwnerId, currentUserId)) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Forbidden - only owner can edit", null));
        }

        // Update fields
        String content = body.get("content");
        String location = body.get("location");
        
        // Music can be provided by trackId or manual input
        String trackId = body.get("trackId");
        String startTimeStr = body.get("startTime");
        Integer startTime = null;
        if (startTimeStr != null && !startTimeStr.isBlank()) {
            try {
                startTime = Integer.parseInt(startTimeStr);
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(400, "startTime must be a number (seconds)", null));
            }
        }
        
        String musicTitle = body.get("musicTitle");
        String musicArtist = body.get("musicArtist");
        String musicCoverUrl = body.get("musicCoverUrl");

        // Validate at least one field present
        boolean hasContent = content != null && !content.isBlank();
        boolean hasLocation = location != null && !location.isBlank();
        boolean hasTrackId = trackId != null && !trackId.isBlank();
        boolean hasMusic = hasTrackId || (musicTitle != null && !musicTitle.isBlank());
        if (!hasContent && !hasLocation && !hasMusic) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Note must have at least text, location, or music", null));
        }
        if (hasContent && content.length() > 200) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Note content must be 200 characters or less", null));
        }

        // Update note
        if (hasContent) note.setContent(content.trim());
        if (hasLocation) note.setLocation(location.trim());

        // Update music if provided
        Music noteMusic = null;
        if (hasTrackId) {
            Optional<MusicMetadata> musicMetadata = musicMetadataRepository.findById(trackId);
            if (musicMetadata.isPresent()) {
                MusicMetadata metadata = musicMetadata.get();
                noteMusic = Music.builder()
                        .trackId(trackId)
                        .startTime(startTime)
                        .title(metadata.getTitle())
                        .artist(metadata.getArtist())
                        .thumbnail(metadata.getImageUrl())
                        .audioUrl(metadata.getAudioUrl())
                        .build();
                log.info("Updated music from MusicMetadata: {}", trackId);
            } else {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error(400, "Music track not found: " + trackId, null));
            }
        } else if (musicTitle != null && !musicTitle.isBlank()) {
            noteMusic = Music.builder()
                    .title(musicTitle)
                    .artist(musicArtist != null ? musicArtist : "")
                    .thumbnail(musicCoverUrl != null ? musicCoverUrl : "")
                    .build();
        }
        
        if (noteMusic != null || hasTrackId || (musicTitle != null && !musicTitle.isBlank())) {
            note.setMusic(noteMusic);
        }

        // Reset expireAt to 24h from now when updating
        Instant now = Instant.now();
        note.setExpireAt(now.plusSeconds(86400));

        Note updated = noteRepository.save(note);
        log.info("Note updated: {}", noteId);
        return ResponseEntity.ok(ApiResponse.success(200, "Note updated", updated));
    }

    /**
     * Delete a note by ID.
     * Only owner can delete their note.
     */
    @DeleteMapping("/{noteId}")
    public ResponseEntity<ApiResponse<Void>> deleteNote(@PathVariable String noteId) {
        Long currentUserId = getCurrentUserId();
        if (currentUserId == null) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error(401, "Unauthorized - authentication required", null));
        }

        Optional<Note> optionalNote = noteRepository.findById(noteId);
        if (optionalNote.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(404, "Note not found", null));
        }

        Note note = optionalNote.get();
        Long noteOwnerId = Long.parseLong(note.getUserId());

        // Check if user is owner
        if (!permissionService.canDeleteNote(noteOwnerId, currentUserId)) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Forbidden - only owner can delete", null));
        }

        noteRepository.deleteById(noteId);
        log.info("Note deleted: {} by user {}", noteId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(200, "Note deleted", null));
    }

    /**
     * Get the current user's ID from JWT token (SecurityContext)
     * Extracts phone_number from JWT and queries User repository
     */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }

        String phoneNumber = auth.getName();
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return null;
        }

        Optional<User> user = permissionService.getUserByPhone(phoneNumber);
        return user.map(User::getId).orElse(null);
    }
}
