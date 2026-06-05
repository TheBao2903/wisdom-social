/*
 * @ (#) StoryDurationCalculator.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.story.config;

import iuh.fit.edu.backend.modules.story.entity.Story;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * @description: Utility class for calculating story duration based on media type and content
 * 
 * Duration Rules:
 * - IMAGE only: 5000ms (5 seconds)
 * - IMAGE + text/sticker: 7000ms (7 seconds)
 * - TEXT only: Dynamic (5000-10000ms based on word count, ~400ms per word)
 * - VIDEO: Actual video duration, capped at 60000ms (60 seconds)
 * 
 * @author: The Bao
 * @date: 2026-05-30
 * @version: 1.0
 */
@Component
@Slf4j
public class StoryDurationCalculator {

    private static final long IMAGE_ONLY_DURATION = 5_000;          // 5 seconds
    private static final long IMAGE_WITH_CONTENT_DURATION = 7_000;  // 7 seconds
    private static final long TEXT_MIN_DURATION = 5_000;            // 5 seconds
    private static final long TEXT_MAX_DURATION = 10_000;           // 10 seconds
    private static final long TEXT_WORD_DURATION = 400;             // 400ms per word
    private static final long VIDEO_MAX_DURATION = 60_000;          // 60 seconds

    /**
     * Calculate story duration based on media type and content
     *
     * @param story Story entity with media, text layers, and stickers
     * @return Duration in milliseconds
     */
    public long calculateDuration(Story story) {
        if (story == null) {
            log.warn("Story is null, returning default duration");
            return IMAGE_ONLY_DURATION;
        }

        String mediaType = story.getMedia() != null ? story.getMedia().getType() : null;

        // VIDEO: actual duration capped at 60 seconds
        if ("video".equalsIgnoreCase(mediaType)) {
            Long videoDuration = story.getMedia().getDuration_ms();
            if (videoDuration == null || videoDuration <= 0) {
                log.warn("Video duration is null or invalid, using default VIDEO duration");
                return VIDEO_MAX_DURATION;
            }
            long cappedDuration = Math.min(videoDuration, VIDEO_MAX_DURATION);
            log.debug("Calculated video duration: {} ms (original: {} ms)", cappedDuration, videoDuration);
            return cappedDuration;
        }

        // Check for text layers and stickers
        boolean hasTextLayers = story.getText_layers() != null && !story.getText_layers().isEmpty();
        boolean hasStickers = story.getMusic_stickers() != null && !story.getMusic_stickers().isEmpty();

        // IMAGE: 5s only, 7s if has text/stickers
        if ("image".equalsIgnoreCase(mediaType)) {
            if (hasTextLayers || hasStickers) {
                log.debug("Calculated image+content duration: {} ms", IMAGE_WITH_CONTENT_DURATION);
                return IMAGE_WITH_CONTENT_DURATION;
            } else {
                log.debug("Calculated image-only duration: {} ms", IMAGE_ONLY_DURATION);
                return IMAGE_ONLY_DURATION;
            }
        }

        // TEXT ONLY: dynamic duration based on word count
        if (hasTextLayers) {
            int wordCount = calculateTotalWordCount(story.getText_layers());
            long duration = TEXT_MIN_DURATION + (wordCount * TEXT_WORD_DURATION);
            long cappedDuration = Math.min(duration, TEXT_MAX_DURATION);
            log.debug("Calculated text-only duration: {} ms (wordCount: {})", cappedDuration, wordCount);
            return cappedDuration;
        }

        // Default fallback
        log.debug("No specific media type matched, returning default duration: {} ms", IMAGE_ONLY_DURATION);
        return IMAGE_ONLY_DURATION;
    }

    /**
     * Calculate total word count from all text layers
     *
     * @param textLayers List of text layers
     * @return Total word count
     */
    private int calculateTotalWordCount(java.util.List<iuh.fit.edu.backend.modules.story.entity.TextLayer> textLayers) {
        if (textLayers == null || textLayers.isEmpty()) {
            return 0;
        }

        return textLayers.stream()
                .map(layer -> layer.getContent())
                .filter(content -> content != null && !content.isBlank())
                .mapToInt(this::countWords)
                .sum();
    }

    /**
     * Count words in text content
     *
     * @param content Text content
     * @return Word count
     */
    private int countWords(String content) {
        if (content == null || content.isBlank()) {
            return 0;
        }
        return content.trim().split("\\s+").length;
    }
}
