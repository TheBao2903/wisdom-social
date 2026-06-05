package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.post.dto.response.FeedSliceResponse;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.repository.PostFeedRepositoryCustom;
import iuh.fit.edu.backend.modules.post.service.FeedService;
import iuh.fit.edu.backend.modules.user.service.FriendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedServiceImpl implements FeedService {

    private static final long INTERACTION_PENALTY_MINUTES = 360;

    private final PostFeedRepositoryCustom postRepository;
    private final FriendService friendService;

    @Override
    public FeedSliceResponse getFeed(Long userId, Instant lastRankingTime, String lastPostId, int size, String prioritizePostId) {
        int pageSize = Math.max(1, Math.min(size, 200));

        List<String> friendIds = friendService.getAcceptedFriendIds(userId)
                .stream()
                .map(String::valueOf)
                .collect(Collectors.toList());

        Set<String> interactedPostIds = postRepository.findInteractedPostIds(userId.toString());

        Instant recentThreshold = Instant.now().minus(24, ChronoUnit.HOURS);
        List<Post> friendPosts = postRepository.findRecentFriendPosts(
                friendIds,
                userId.toString(),
                lastRankingTime,
                lastPostId,
                recentThreshold,
                pageSize + 1,
                interactedPostIds
        );

        Instant selfThreshold = Instant.now().minus(2, ChronoUnit.HOURS);
        List<Post> myPosts = lastRankingTime == null
                ? postRepository.findActiveSelfPosts(userId.toString(), selfThreshold, 10)
                : Collections.emptyList();

        List<Post> result = new ArrayList<>(pageSize + 1);
        Set<String> seen = new HashSet<>();

        for (Post post : myPosts) {
            if (seen.add(post.getId())) {
                result.add(post);
            }
            if (result.size() > pageSize) {
                break;
            }
        }

        for (Post post : friendPosts) {
            if (seen.add(post.getId())) {
                result.add(post);
            }
            if (result.size() > pageSize) {
                break;
            }
        }

        int remaining = pageSize + 1 - result.size();
        if (remaining > 0) {
            List<Post> fallbackPosts = postRepository.findRandomFallbackPosts(
                    friendIds,
                    userId.toString(),
                    lastRankingTime,
                    lastPostId,
                    recentThreshold,
                    new ArrayList<>(seen),
                    remaining,
                    interactedPostIds
            );

            for (Post post : fallbackPosts) {
                if (seen.add(post.getId())) {
                    result.add(post);
                }
                if (result.size() > pageSize) {
                    break;
                }
            }
        }

        boolean hasNext = result.size() > pageSize;
        if (hasNext) {
            result = result.subList(0, pageSize);
        }

        Post cursorPost = result.isEmpty() ? null : result.get(result.size() - 1);

        return FeedSliceResponse.builder()
                .posts(result)
                .hasNext(hasNext)
                .nextCursorCreatedAt(cursorPost == null ? null : effectiveRankingTime(cursorPost, interactedPostIds))
                .nextCursorPostId(cursorPost == null ? null : cursorPost.getId())
                .build();
    }

    private Instant effectiveRankingTime(Post post, Set<String> interactedPostIds) {
        Instant rankingTime = post.getRankingTime() != null
                ? post.getRankingTime()
                : post.getCreatedAt() != null ? post.getCreatedAt() : Instant.EPOCH;
        if (interactedPostIds != null && interactedPostIds.contains(post.getId())) {
            return rankingTime.minus(INTERACTION_PENALTY_MINUTES, ChronoUnit.MINUTES);
        }
        return rankingTime;
    }
}
