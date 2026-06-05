package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.post.entity.HashtagTrending;
import iuh.fit.edu.backend.modules.post.entity.TrendingStats;
import iuh.fit.edu.backend.modules.post.repository.HashtagTrendingRepository;
import iuh.fit.edu.backend.modules.post.service.HashtagTrendingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class HashtagTrendingServiceImpl implements HashtagTrendingService {

    private final HashtagTrendingRepository repository;

    @Override
    public void updateHashtagOnPostCreated(String postId, String authorId, List<String> hashtags) {
        if (hashtags == null || hashtags.isEmpty()) {
            return;
        }
        log.info("Updating hashtag trending stats for new post: {}, hashtags: {}", postId, hashtags);
        Instant now = Instant.now();
        Instant expire = now.plus(30, ChronoUnit.DAYS);

        for (String hashtag : hashtags) {
            String cleanHashtag = hashtag.trim().toLowerCase();
            if (cleanHashtag.isEmpty()) continue;

            Optional<HashtagTrending> existingOpt = repository.findByHashtagAndPeriod(cleanHashtag, "all");
            if (existingOpt.isPresent()) {
                HashtagTrending existing = existingOpt.get();
                TrendingStats stats = existing.getStats();
                if (stats == null) {
                    stats = TrendingStats.builder().build();
                }
                stats.setPostCount(stats.getPostCount() + 1);
                // Simple estimate of user count increment (we can just keep it or increment by 1)
                stats.setUserCount(stats.getUserCount() + 1);
                stats.setPeakTime(now);

                List<String> samples = existing.getSamplePostIds();
                if (samples == null) {
                    samples = new ArrayList<>();
                }
                if (!samples.contains(postId)) {
                    samples.add(0, postId);
                    if (samples.size() > 10) {
                        samples = new ArrayList<>(samples.subList(0, 10));
                    }
                    existing.setSamplePostIds(samples);
                }

                existing.setUpdatedAt(now);
                existing.setExpireAt(expire);

                double score = stats.getPostCount() * 5.0 + stats.getEngagementCount() * 2.0;
                existing.setTrendingScore(score);

                repository.save(existing);
            } else {
                TrendingStats stats = TrendingStats.builder()
                        .postCount(1)
                        .userCount(1)
                        .viewCount(0)
                        .engagementCount(0)
                        .velocity(0.0)
                        .peakTime(now)
                        .build();

                List<String> samples = new ArrayList<>();
                samples.add(postId);

                HashtagTrending trending = HashtagTrending.builder()
                        .hashtag(cleanHashtag)
                        .period("all")
                        .stats(stats)
                        .trendingScore(5.0)
                        .samplePostIds(samples)
                        .startTime(now)
                        .endTime(expire)
                        .updatedAt(now)
                        .expireAt(expire)
                        .build();

                repository.save(trending);
            }
        }
    }

    @Override
    public void updateHashtagOnPostUpdated(String postId, String authorId, List<String> oldHashtags, List<String> newHashtags) {
        log.info("Updating hashtag trending stats for updated post: {}", postId);
        
        List<String> oldClean = oldHashtags != null ? oldHashtags.stream().map(h -> h.trim().toLowerCase()).toList() : List.of();
        List<String> newClean = newHashtags != null ? newHashtags.stream().map(h -> h.trim().toLowerCase()).toList() : List.of();

        List<String> added = newClean.stream().filter(h -> !oldClean.contains(h)).toList();
        List<String> removed = oldClean.stream().filter(h -> !newClean.contains(h)).toList();

        if (!added.isEmpty()) {
            updateHashtagOnPostCreated(postId, authorId, added);
        }
        if (!removed.isEmpty()) {
            updateHashtagOnPostDeleted(postId, removed);
        }
    }

    @Override
    public void updateHashtagOnPostDeleted(String postId, List<String> hashtags) {
        if (hashtags == null || hashtags.isEmpty()) {
            return;
        }
        log.info("Updating hashtag trending stats for deleted post: {}, hashtags: {}", postId, hashtags);
        Instant now = Instant.now();

        for (String hashtag : hashtags) {
            String cleanHashtag = hashtag.trim().toLowerCase();
            if (cleanHashtag.isEmpty()) continue;

            Optional<HashtagTrending> existingOpt = repository.findByHashtagAndPeriod(cleanHashtag, "all");
            if (existingOpt.isPresent()) {
                HashtagTrending existing = existingOpt.get();
                TrendingStats stats = existing.getStats();
                if (stats != null) {
                    long newPostCount = Math.max(0, stats.getPostCount() - 1);
                    stats.setPostCount(newPostCount);
                    long newUserCount = Math.max(0, stats.getUserCount() - 1);
                    stats.setUserCount(newUserCount);
                }

                List<String> samples = existing.getSamplePostIds();
                if (samples != null) {
                    samples.remove(postId);
                    existing.setSamplePostIds(samples);
                }

                existing.setUpdatedAt(now);
                double score = 0.0;
                if (stats != null) {
                    score = stats.getPostCount() * 5.0 + stats.getEngagementCount() * 2.0;
                }
                existing.setTrendingScore(score);

                repository.save(existing);
            }
        }
    }

    @Override
    public Page<HashtagTrending> getTrendingHashtags(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "trendingScore", "updatedAt"));
        return repository.findByPeriod("all", pageable);
    }
}
