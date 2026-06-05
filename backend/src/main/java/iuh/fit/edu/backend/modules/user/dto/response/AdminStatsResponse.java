package iuh.fit.edu.backend.modules.user.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatsResponse {
    private long totalUsers;
    private long activeToday;
    private long newThisWeek;
    private long lockedUsers;
    private long totalPosts;
    private long totalStories;
    private long totalPages;
    private List<DayCount> registrationsByDay;
    private List<DayCount> postsByDay;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayCount {
        private String date;
        private long count;
    }
}
