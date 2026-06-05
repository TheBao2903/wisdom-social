/*
 * @ (#) MusicService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.music.service;

import iuh.fit.edu.backend.modules.music.entity.MusicMetadata;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/*
 * @description: Music metadata service interface
 * @author: The Bao
 * @date: 2026-03-24
 * @version: 1.0
 */
public interface MusicService {
    /**
     * Get all music tracks with pagination
     * @param pageable pagination info
     * @return paginated music tracks
     */
    Page<MusicMetadata> getAllMusic(Pageable pageable);

    /**
     * Search music by title (case-insensitive)
     * @param title search term
     * @return list of matching music tracks
     */
    List<MusicMetadata> searchMusicByTitle(String title);

    /**
     * Search music by artist (case-insensitive)
     * @param artist search term
     * @return list of matching music tracks
     */
    List<MusicMetadata> searchMusicByArtist(String artist);

    /**
     * Get music by ID
     * @param musicId music ID
     * @return Optional containing music if found
     */
    Optional<MusicMetadata> getMusicById(String musicId);

    /**
     * Create new music metadata
     * @param musicMetadata music entity to create
     * @return saved music entity
     */
    MusicMetadata createMusic(MusicMetadata musicMetadata);

    /**
     * Update music metadata
     * @param musicId music ID
     * @param musicMetadata updated music data
     * @return updated music entity
     */
    Optional<MusicMetadata> updateMusic(String musicId, MusicMetadata musicMetadata);

    /**
     * Delete music by ID
     * @param musicId music ID
     * @return true if deleted, false if not found
     */
    boolean deleteMusic(String musicId);
}
