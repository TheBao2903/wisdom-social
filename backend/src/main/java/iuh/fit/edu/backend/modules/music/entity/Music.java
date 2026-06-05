package iuh.fit.edu.backend.modules.music.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Music {
    private String trackId;     // reference to MusicMetadata
    private Integer startTime;  // user chọn đoạn (seconds)

    // snapshot from MusicMetadata
    private String title;
    private String artist;
    private String thumbnail;
    private String audioUrl;   // lấy từ MusicMetadata
    private Long duration;

    // video original audio config
    private Boolean muteOriginal;
    private Integer originalVolume;
    private Integer musicVolume;
}