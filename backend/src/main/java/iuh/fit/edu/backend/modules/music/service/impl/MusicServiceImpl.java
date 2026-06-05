/*
 * @ (#) MusicServiceImpl.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.music.service.impl;

import iuh.fit.edu.backend.modules.music.entity.MusicMetadata;
import iuh.fit.edu.backend.modules.music.repository.MusicMetadataRepository;
import iuh.fit.edu.backend.modules.music.service.MusicService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/*
 * @description: Music metadata service implementation
 * @author: The Bao
 * @date: 2026-03-24
 * @version: 1.0
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MusicServiceImpl implements MusicService {

    private final MusicMetadataRepository musicRepository;

    @Override
    public Page<MusicMetadata> getAllMusic(Pageable pageable) {
        log.info("Fetching music with pagination: page={}, size={}", pageable.getPageNumber(), pageable.getPageSize());
        Page<MusicMetadata> result = musicRepository.findAll(pageable);
        log.info("Retrieved {} music tracks", result.getContent().size());
        return result;
    }

    @Override
    public List<MusicMetadata> searchMusicByTitle(String title) {
        if (title == null || title.trim().isEmpty()) {
            log.warn("Search title is empty");
            return List.of();
        }
        log.info("Searching music by title: {}", title);
        List<MusicMetadata> results = musicRepository.findByTitleContainingIgnoreCase(title);
        log.info("Found {} tracks with title containing '{}'", results.size(), title);
        return results;
    }

    @Override
    public List<MusicMetadata> searchMusicByArtist(String artist) {
        if (artist == null || artist.trim().isEmpty()) {
            log.warn("Search artist is empty");
            return List.of();
        }
        log.info("Searching music by artist: {}", artist);
        List<MusicMetadata> results = musicRepository.findByArtistContainingIgnoreCase(artist);
        log.info("Found {} tracks with artist containing '{}'", results.size(), artist);
        return results;
    }

    @Override
    public Optional<MusicMetadata> getMusicById(String musicId) {
        if (musicId == null || musicId.trim().isEmpty()) {
            log.warn("Music ID is empty");
            return Optional.empty();
        }
        log.info("Fetching music by ID: {}", musicId);
        Optional<MusicMetadata> result = musicRepository.findById(musicId);
        if (result.isPresent()) {
            log.info("Music found: {}", musicId);
        } else {
            log.warn("Music not found: {}", musicId);
        }
        return result;
    }

    @Override
    public MusicMetadata createMusic(MusicMetadata musicMetadata) {
        if (musicMetadata == null) {
            throw new IllegalArgumentException("Music metadata cannot be null");
        }
        // Set creation timestamp if not set
        if (musicMetadata.getCreatedAt() == null) {
            musicMetadata.setCreatedAt(Instant.now());
        }
        log.info("Creating new music: title={}, artist={}", musicMetadata.getTitle(), musicMetadata.getArtist());
        MusicMetadata saved = musicRepository.save(musicMetadata);
        log.info("Music created successfully with ID: {}", saved.getId());
        return saved;
    }

    @Override
    public Optional<MusicMetadata> updateMusic(String musicId, MusicMetadata musicMetadata) {
        if (musicId == null || musicId.trim().isEmpty()) {
            throw new IllegalArgumentException("Music ID cannot be null or empty");
        }
        if (musicMetadata == null) {
            throw new IllegalArgumentException("Music metadata cannot be null");
        }

        log.info("Updating music: {}", musicId);
        Optional<MusicMetadata> existing = musicRepository.findById(musicId);

        if (existing.isPresent()) {
            MusicMetadata toUpdate = existing.get();

            // Update fields
            if (musicMetadata.getTitle() != null) {
                toUpdate.setTitle(musicMetadata.getTitle());
            }
            if (musicMetadata.getArtist() != null) {
                toUpdate.setArtist(musicMetadata.getArtist());
            }
            if (musicMetadata.getDuration() != null) {
                toUpdate.setDuration(musicMetadata.getDuration());
            }
            if (musicMetadata.getImageUrl() != null) {
                toUpdate.setImageUrl(musicMetadata.getImageUrl());
            }
            if (musicMetadata.getAudioUrl() != null) {
                toUpdate.setAudioUrl(musicMetadata.getAudioUrl());
            }

            MusicMetadata updated = musicRepository.save(toUpdate);
            log.info("Music updated successfully: {}", musicId);
            return Optional.of(updated);
        } else {
            log.warn("Music not found for update: {}", musicId);
            return Optional.empty();
        }
    }

    @Override
    public boolean deleteMusic(String musicId) {
        if (musicId == null || musicId.trim().isEmpty()) {
            throw new IllegalArgumentException("Music ID cannot be null or empty");
        }

        log.info("Deleting music: {}", musicId);
        if (musicRepository.existsById(musicId)) {
            musicRepository.deleteById(musicId);
            log.info("Music deleted successfully: {}", musicId);
            return true;
        } else {
            log.warn("Music not found for deletion: {}", musicId);
            return false;
        }
    }
}
