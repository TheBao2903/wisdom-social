package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.notification.constant.TargetType;
import iuh.fit.edu.backend.modules.post.constant.PrivacyType;
import iuh.fit.edu.backend.modules.post.constant.StatusType;
import iuh.fit.edu.backend.modules.post.entity.Comment;
import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.entity.PostShare;
import iuh.fit.edu.backend.modules.post.entity.Reaction;
import iuh.fit.edu.backend.modules.post.entity.SavedPost;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Repository
@RequiredArgsConstructor
public class PostFeedRepositoryCustomImpl implements PostFeedRepositoryCustom {

    private static final long INTERACTION_PENALTY_MINUTES = 360;
    private static final int MAX_CANDIDATE_WINDOW = 500;

    private final MongoTemplate mongoTemplate;
    private final ReactionRepository reactionRepository;
    private final CommentRepository commentRepository;
    private final SavedPostRepository savedPostRepository;
    private final PostShareRepository postShareRepository;

    @Override
    public Set<String> findInteractedPostIds(String currentUserId) {
        Set<String> interacted = new HashSet<>();
        if (currentUserId == null || currentUserId.isBlank()) {
            return interacted;
        }

        reactionRepository.findByUserIdAndTargetType(currentUserId, TargetType.POST)
                .stream()
                .map(Reaction::getTargetId)
                .filter(Objects::nonNull)
                .forEach(interacted::add);

        commentRepository.findByUserIdAndStatus(currentUserId, StatusType.ACTIVE)
                .stream()
                .filter(comment -> comment.getTargetType() == TargetType.POST)
                .map(Comment::getTargetId)
                .filter(Objects::nonNull)
                .forEach(interacted::add);

        savedPostRepository.findByUserIdAndTargetType(currentUserId, TargetType.POST)
                .stream()
                .map(SavedPost::getTargetId)
                .filter(Objects::nonNull)
                .forEach(interacted::add);

        postShareRepository.findBySharedByUserIdAndStatus(currentUserId, StatusType.ACTIVE)
                .stream()
                .map(PostShare::getOriginalPostId)
                .filter(Objects::nonNull)
                .forEach(interacted::add);

        return interacted;
    }

    @Override
    public List<Post> findRecentFriendPosts(
            List<String> friendIds,
            String currentUserId,
            Instant lastRankingTime,
            String lastPostId,
            Instant recentThreshold,
            int size,
            Set<String> interactedPostIds
    ) {
        if (friendIds == null || friendIds.isEmpty() || size <= 0) {
            return List.of();
        }

        List<Criteria> criteria = baseVisibleCriteria(currentUserId, friendIds);
        criteria.add(Criteria.where("authorId").in(friendIds));
        criteria.add(Criteria.where("rankingTime").gte(recentThreshold));

        Query query = new Query(new Criteria().andOperator(criteria.toArray(new Criteria[0])));
        query.with(Sort.by(Sort.Direction.DESC, "rankingTime").and(Sort.by(Sort.Direction.DESC, "_id")));
        query.limit(candidateLimit(size));

        return sortAndPageByPersonalizedRank(
                mongoTemplate.find(query, Post.class),
                lastRankingTime,
                lastPostId,
                size,
                interactedPostIds
        );
    }

    @Override
    public List<Post> findRandomFallbackPosts(
            List<String> friendIds,
            String currentUserId,
            Instant lastRankingTime,
            String lastPostId,
            Instant olderThan,
            List<String> excludePostIds,
            int size,
            Set<String> interactedPostIds
    ) {
        if (size <= 0) {
            return List.of();
        }

        List<Criteria> criteria = baseVisibleCriteria(currentUserId, friendIds);
        criteria.add(Criteria.where("rankingTime").lt(olderThan));
        criteria.add(Criteria.where("authorId").ne(currentUserId));
        if (excludePostIds != null && !excludePostIds.isEmpty()) {
            criteria.add(Criteria.where("_id").nin(excludePostIds));
        }

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(new Criteria().andOperator(criteria.toArray(new Criteria[0]))),
                Aggregation.sample(candidateLimit(size))
        );

        return sortAndPageByPersonalizedRank(
                mongoTemplate.aggregate(aggregation, "posts", Post.class).getMappedResults(),
                lastRankingTime,
                lastPostId,
                size,
                interactedPostIds
        );
    }

    @Override
    public List<Post> findProfilePosts(String targetUserId, String currentUserId, List<String> friendIds, int page, int size) {
        Query query = profileQuery(targetUserId, currentUserId, friendIds);
        query.with(Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")));
        query.skip((long) Math.max(page, 0) * Math.max(size, 1));
        query.limit(Math.max(size, 1));
        return mongoTemplate.find(query, Post.class);
    }

    @Override
    public long countProfilePosts(String targetUserId, String currentUserId, List<String> friendIds) {
        return mongoTemplate.count(profileQuery(targetUserId, currentUserId, friendIds), Post.class);
    }

    @Override
    public List<Post> findActiveSelfPosts(String userId, Instant recentThreshold, int size) {
        if (size <= 0) {
            return List.of();
        }
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("authorId").is(userId),
                Criteria.where("status").is(StatusType.ACTIVE),
                Criteria.where("rankingTime").gte(recentThreshold)
        ));
        query.with(Sort.by(Sort.Direction.DESC, "rankingTime").and(Sort.by(Sort.Direction.DESC, "_id")));
        query.limit(size);
        return mongoTemplate.find(query, Post.class);
    }

    @Override
    public List<Post> findPostsByHashtag(String hashtag, String currentUserId, List<String> friendIds, int page, int size) {
        Query query = hashtagQuery(hashtag, currentUserId, friendIds);
        query.with(Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")));
        query.skip((long) Math.max(page, 0) * Math.max(size, 1));
        query.limit(Math.max(size, 1));
        return mongoTemplate.find(query, Post.class);
    }

    @Override
    public long countPostsByHashtag(String hashtag, String currentUserId, List<String> friendIds) {
        return mongoTemplate.count(hashtagQuery(hashtag, currentUserId, friendIds), Post.class);
    }

    private Query profileQuery(String targetUserId, String currentUserId, List<String> friendIds) {
        List<Criteria> criteria = baseVisibleCriteria(currentUserId, friendIds);
        criteria.add(Criteria.where("authorId").is(targetUserId));
        return new Query(new Criteria().andOperator(criteria.toArray(new Criteria[0])));
    }

    private Query hashtagQuery(String hashtag, String currentUserId, List<String> friendIds) {
        List<Criteria> criteria = baseVisibleCriteria(currentUserId, friendIds);
        criteria.add(Criteria.where("hashtags").is(normalizeHashtag(hashtag)));
        return new Query(new Criteria().andOperator(criteria.toArray(new Criteria[0])));
    }

    private List<Criteria> baseVisibleCriteria(String currentUserId, List<String> friendIds) {
        List<Criteria> criteria = new ArrayList<>();
        criteria.add(Criteria.where("status").is(StatusType.ACTIVE));
        criteria.add(privacyCriteria(currentUserId, friendIds));
        return criteria;
    }

    private Criteria privacyCriteria(String currentUserId, List<String> friendIds) {
        List<Criteria> visible = new ArrayList<>();
        visible.add(Criteria.where("privacy").is(PrivacyType.PUBLIC));

        if (currentUserId != null && !currentUserId.isBlank()) {
            visible.add(new Criteria().andOperator(
                    Criteria.where("privacy").is(PrivacyType.ONLY_ME),
                    Criteria.where("authorId").is(currentUserId)
            ));
            visible.add(new Criteria().andOperator(
                    Criteria.where("privacy").is(PrivacyType.SPECIFIC),
                    Criteria.where("specificViewerUserIds").is(currentUserId)
            ));
            visible.add(new Criteria().andOperator(
                    Criteria.where("privacy").is(PrivacyType.EXCEPT),
                    Criteria.where("excludedUserIds").ne(currentUserId)
            ));
        }

        if (friendIds != null && !friendIds.isEmpty()) {
            visible.add(new Criteria().andOperator(
                    Criteria.where("privacy").is(PrivacyType.FRIENDS),
                    Criteria.where("authorId").in(friendIds)
            ));
        }

        return new Criteria().orOperator(visible.toArray(new Criteria[0]));
    }

    private List<Post> sortAndPageByPersonalizedRank(
            List<Post> posts,
            Instant lastRankingTime,
            String lastPostId,
            int size,
            Set<String> interactedPostIds
    ) {
        if (posts == null || posts.isEmpty()) {
            return List.of();
        }

        List<Post> sortedPosts = new ArrayList<>(posts);
        sortedPosts.sort((left, right) -> {
            int rankCompare = effectiveRankingTime(right, interactedPostIds)
                    .compareTo(effectiveRankingTime(left, interactedPostIds));
            if (rankCompare != 0) {
                return rankCompare;
            }
            return nullSafeId(right).compareTo(nullSafeId(left));
        });

        return sortedPosts.stream()
                .filter(post -> isAfterCursor(post, lastRankingTime, lastPostId, interactedPostIds))
                .limit(size)
                .toList();
    }

    private boolean isAfterCursor(Post post, Instant lastRankingTime, String lastPostId, Set<String> interactedPostIds) {
        if (lastRankingTime == null) {
            return true;
        }

        Instant effectiveRank = effectiveRankingTime(post, interactedPostIds);
        int timeCompare = effectiveRank.compareTo(lastRankingTime);
        if (timeCompare < 0) {
            return true;
        }
        if (timeCompare > 0 || lastPostId == null || lastPostId.isBlank()) {
            return false;
        }
        return nullSafeId(post).compareTo(lastPostId) < 0;
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

    private int candidateLimit(int requestedSize) {
        return Math.min(MAX_CANDIDATE_WINDOW, Math.max(requestedSize * 4, requestedSize + 1));
    }

    private String nullSafeId(Post post) {
        return post.getId() == null ? "" : post.getId();
    }

    private String normalizeHashtag(String hashtag) {
        if (hashtag == null) {
            return "";
        }
        String clean = hashtag.trim();
        return clean.startsWith("#") ? clean.substring(1).toLowerCase() : clean.toLowerCase();
    }
}
