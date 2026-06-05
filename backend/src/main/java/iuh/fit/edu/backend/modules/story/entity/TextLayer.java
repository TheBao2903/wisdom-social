/*
 * @ (#) TextLayer.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * @description: Text layer entity for story text overlay
 * - Responsive positioning using percentage-based coordinates
 * - No pixel-based absolute positioning
 * - Supports drag, resize, and styling
 * @author: The Bao
 * @date: 2026-05-30
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TextLayer {

    private String id;
    private String content;

    // Positioning (percentage-based, responsive)
    private Float x_pct;  // 0.0 -> 1.0
    private Float y_pct;  // 0.0 -> 1.0

    // Sizing (percentage-based, can be null for auto-sizing)
    private Float width_pct;   // 0.0 -> 1.0, optional
    private Float height_pct;  // 0.0 -> 1.0, optional

    // Text styling
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TextStyle {
        private Integer fontSize;      // Font size in px
        private String fontFamily;     // Font family name (e.g., "Arial", "Roboto")
        private String color;          // HEX color (e.g., "#FFFFFF")
        private String align;          // left | center | right
        private Float rotation;        // Rotation degrees (0-360)
        private Boolean bold;          // Bold text
        private Boolean shadow;        // Text shadow effect
    }

    private TextStyle style;

    // Layer ordering
    private Integer z_index;
}
