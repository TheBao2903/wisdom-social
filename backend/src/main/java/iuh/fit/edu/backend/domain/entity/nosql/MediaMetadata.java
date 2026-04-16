/*
 * @ (#) MediaMetadata.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/*
 * @description: MediaMetadata entity for Media (EXIF data)
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaMetadata {
    private String cameraModel; // Model camera/điện thoại
    private String lens; // Ống kính sử dụng
    private String iso; // ISO setting
    private String focalLength; // Độ dài tiêu cự
    private String aperture; // Khẩu độ (f-stop)
    private String shutterSpeed; // Tốc độ màn trập
    private Instant capturedAt; // Thời gian chụp/quay thực tế
    private String resolution; // Độ phân giải
    private Long fileSize; // Kích thước file (bytes)
}
