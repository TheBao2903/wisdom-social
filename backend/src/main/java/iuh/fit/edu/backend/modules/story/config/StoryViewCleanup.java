package iuh.fit.edu.backend.modules.story.config;

import iuh.fit.edu.backend.modules.story.entity.StoryView;
import iuh.fit.edu.backend.modules.story.repository.StoryViewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Cleanup duplicate StoryView records on startup.
 * This handles legacy data where duplicates were created due to race conditions
 * before the unique index enforcement.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StoryViewCleanup implements ApplicationRunner {

    private final StoryViewRepository storyViewRepository;

    @Override
    public void run(ApplicationArguments args) {
        try {
            log.info("[StoryViewCleanup] Starting duplicate StoryView cleanup...");
            List<StoryView> allViews = storyViewRepository.findAll();
            
            // Group by (storyId, viewerId)
            Map<String, List<StoryView>> grouped = allViews.stream()
                    .collect(Collectors.groupingBy(v -> v.getStoryId() + "|" + v.getViewerId()));
            
            int duplicatesRemoved = 0;
            for (Map.Entry<String, List<StoryView>> entry : grouped.entrySet()) {
                List<StoryView> views = entry.getValue();
                if (views.size() > 1) {
                    // Keep the first (oldest), delete the rest
                    views.sort(Comparator.comparing(v -> v.getCreatedAt() != null ? v.getCreatedAt() : java.time.Instant.EPOCH));
                    for (int i = 1; i < views.size(); i++) {
                        storyViewRepository.deleteById(views.get(i).getId());
                        duplicatesRemoved++;
                    }
                }
            }
            
            if (duplicatesRemoved > 0) {
                log.info("[StoryViewCleanup] Removed {} duplicate StoryView records", duplicatesRemoved);
            } else {
                log.info("[StoryViewCleanup] No duplicates found");
            }
        } catch (Exception e) {
            log.warn("[StoryViewCleanup] Cleanup failed (non-fatal): {}", e.getMessage());
        }
    }
}
