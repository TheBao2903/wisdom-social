package iuh.fit.edu.backend.modules.post.service;

import java.time.Instant;

import iuh.fit.edu.backend.modules.post.dto.response.FeedSliceResponse;

public interface FeedService {

    FeedSliceResponse getFeed(Long userId, Instant lastRankingTime, String lastPostId, int size, String prioritizePostId);
}
