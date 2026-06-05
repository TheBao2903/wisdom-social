package iuh.fit.edu.backend.modules.user.service.impl;

import iuh.fit.edu.backend.modules.page.repository.PageRepository;
import iuh.fit.edu.backend.modules.post.repository.PostRepository;
import iuh.fit.edu.backend.modules.story.repository.StoryRepository;
import iuh.fit.edu.backend.modules.user.dto.response.AdminStatsResponse;
import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import iuh.fit.edu.backend.modules.user.service.AdminStatsService;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminStatsServiceImpl implements AdminStatsService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final StoryRepository storyRepository;
    private final PageRepository pageRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public AdminStatsResponse getStats() {
        OffsetDateTime now = OffsetDateTime.now();
        Instant nowInstant = Instant.now();

        long totalUsers = userRepository.count();
        long lockedUsers = userRepository.countByLockedTrue();
        long activeToday = userRepository.countByLastActiveAtAfter(nowInstant.minus(1, ChronoUnit.DAYS));
        long newThisWeek = userRepository.countByCreatedAtAfter(now.minusDays(7));
        long totalPosts = postRepository.count();
        long totalStories = storyRepository.count();
        long totalPages = pageRepository.count();

        List<AdminStatsResponse.DayCount> registrationsByDay = buildRegistrationsByDay(now);
        List<AdminStatsResponse.DayCount> postsByDay = buildPostsByDay();

        return AdminStatsResponse.builder()
                .totalUsers(totalUsers)
                .activeToday(activeToday)
                .newThisWeek(newThisWeek)
                .lockedUsers(lockedUsers)
                .totalPosts(totalPosts)
                .totalStories(totalStories)
                .totalPages(totalPages)
                .registrationsByDay(registrationsByDay)
                .postsByDay(postsByDay)
                .build();
    }

    private List<AdminStatsResponse.DayCount> buildRegistrationsByDay(OffsetDateTime now) {
        int days = 30;
        OffsetDateTime since = now.minusDays(days);
        List<User> recentUsers = userRepository.findByCreatedAtAfter(since);

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Long> buckets = new LinkedHashMap<>();
        for (int i = days - 1; i >= 0; i--) {
            buckets.put(LocalDate.now().minusDays(i).format(fmt), 0L);
        }

        for (User u : recentUsers) {
            if (u.getCreatedAt() == null) continue;
            String key = u.getCreatedAt().toLocalDate().format(fmt);
            buckets.computeIfPresent(key, (k, v) -> v + 1);
        }

        List<AdminStatsResponse.DayCount> result = new ArrayList<>();
        buckets.forEach((date, count) -> result.add(new AdminStatsResponse.DayCount(date, count)));
        return result;
    }

    private List<AdminStatsResponse.DayCount> buildPostsByDay() {
        Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);

        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("createdAt").gte(thirtyDaysAgo)),
                Aggregation.project()
                        .andExpression("dateToString('%Y-%m-%d', createdAt)").as("date"),
                Aggregation.group("date").count().as("count"),
                Aggregation.sort(org.springframework.data.domain.Sort.Direction.ASC, "_id")
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(agg, "posts", Document.class);

        Map<String, Long> buckets = new LinkedHashMap<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        for (int i = 29; i >= 0; i--) {
            buckets.put(LocalDate.now(ZoneId.systemDefault()).minusDays(i).format(fmt), 0L);
        }

        for (Document doc : results.getMappedResults()) {
            String date = doc.getString("_id");
            long count = doc.get("count", Number.class).longValue();
            if (buckets.containsKey(date)) {
                buckets.put(date, count);
            }
        }

        List<AdminStatsResponse.DayCount> result = new ArrayList<>();
        buckets.forEach((date, count) -> result.add(new AdminStatsResponse.DayCount(date, count)));
        return result;
    }
}
