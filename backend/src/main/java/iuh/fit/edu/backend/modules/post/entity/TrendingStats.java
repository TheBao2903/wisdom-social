package iuh.fit.edu.backend.modules.post.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendingStats {
    private long postCount;
    private long userCount; // Số user unique sử dụng
    private long viewCount;
    private long engagementCount; // reactions + comments + shares
    
    // Velocity (tốc độ tăng trưởng)
    private Double velocity;
    
    // Peak time
    private Instant peakTime;
}
