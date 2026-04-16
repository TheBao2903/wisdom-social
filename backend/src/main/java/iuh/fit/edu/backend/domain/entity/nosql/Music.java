package iuh.fit.edu.backend.domain.entity.nosql;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Music {
    private String trackId;     // reference to MusicMetadata
    private Integer startTime;  // user chọn đoạn (seconds)

    // snapshot from MusicMetadata
    private String title;
    private String artist;
    private String thumbnail;
    private String audioUrl;   // lấy từ MusicMetadata
}