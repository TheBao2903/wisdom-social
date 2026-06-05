/*
 * @ (#) MusicSticker.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * @description: Music sticker entity for story music overlay
 * - Responsive positioning using percentage-based coordinates
 * - Supports rotation, drag, and resize
 * - Stores music metadata (title, artist, duration, etc.)
 * @author: The Bao
 * @date: 2026-05-30
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MusicSticker {

    private String id;

    // Positioning (percentage-based, responsive)
    private Float x_pct;  // 0.0 -> 1.0
    private Float y_pct;  // 0.0 -> 1.0

    // Sizing (percentage-based, can be null for auto-sizing)
    private Float width_pct;   // 0.0 -> 1.0, optional
    private Float height_pct;  // 0.0 -> 1.0, optional

    // Rotation (degrees)
    private Float rotation_deg;

    // Music metadata
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MusicMetadata {
        private String track_id;       // Music track ID
        private String title;          // Track title
        private String artist;         // Artist name
        private String cover_url;      // Cover image URL (optional)
        private Integer start_sec;     // Start time in seconds (optional)
        private Integer end_sec;       // End time in seconds (optional)
    }

    private MusicMetadata meta;

    // Style variant (compact|rectangle|square|vinyl|hidden)
    private String style;

    // Layer ordering
    private Integer z_index;
}
