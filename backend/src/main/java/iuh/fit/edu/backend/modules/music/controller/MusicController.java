package iuh.fit.edu.backend.modules.music.controller;

import iuh.fit.edu.backend.modules.music.entity.MusicMetadata;
import iuh.fit.edu.backend.common.dto.response.ApiResponse;
import iuh.fit.edu.backend.modules.music.service.MusicService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
 * @description: Music metadata management controller
 * @author: The Bao
 * @date: 2026-03-23
 */
@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
@Slf4j
public class MusicController {

    private final MusicService musicService;

    /**
     * Get all music tracks with pagination
     * @param page page number (0-indexed)
     * @param size page size (default: 20)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<MusicMetadata>>> getAllMusic(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<MusicMetadata> music = musicService.getAllMusic(pageable);
        log.info("Fetched {} music tracks", music.getContent().size());
        return ResponseEntity.ok(
                ApiResponse.success(200, "Music list retrieved", music)
        );
    }

    /**
     * Search music by title
     */
    @GetMapping("/search/title")
    public ResponseEntity<ApiResponse<List<MusicMetadata>>> searchByTitle(
            @RequestParam String title) {
        List<MusicMetadata> results = musicService.searchMusicByTitle(title);
        log.info("Found {} tracks for title: {}", results.size(), title);
        return ResponseEntity.ok(
                ApiResponse.success(200, "Search results", results)
        );
    }

    /**
     * Search music by artist
     */
    @GetMapping("/search/artist")
    public ResponseEntity<ApiResponse<List<MusicMetadata>>> searchByArtist(
            @RequestParam String artist) {
        List<MusicMetadata> results = musicService.searchMusicByArtist(artist);
        log.info("Found {} tracks for artist: {}", results.size(), artist);
        return ResponseEntity.ok(
                ApiResponse.success(200, "Search results", results)
        );
    }

    /**
     * Get music track by ID
     */
    @GetMapping("/{musicId}")
    public ResponseEntity<ApiResponse<MusicMetadata>> getMusicById(
            @PathVariable String musicId) {
        return musicService.getMusicById(musicId)
                .map(music -> {
                    log.info("Fetched music: {}", musicId);
                    return ResponseEntity.ok(
                            ApiResponse.success(200, "Music found", music)
                    );
                })
                .orElseGet(() -> {
                    log.warn("Music not found: {}", musicId);
                    return ResponseEntity.status(404)
                            .body(ApiResponse.error(404, "Music not found", null));
                });
    }
}
