/*
 * @ (#) Media.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import iuh.fit.edu.backend.domain.entity.nosql.embeddable.Location;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/*
 * @description: Media entity for Post
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Media {
    private Integer order; // Thứ tự hiển thị trong carousel (0, 1, 2...)
    private String url;
    private String type; // image | video | gif
    private String thumbnailUrl; // Thumbnail cho video
    private Integer width;
    private Integer height;
    private Long duration; // Duration cho video (seconds)
    private String altText; // Accessibility
    
    // Content riêng cho mỗi media item (giống Instagram carousel)
    private String caption; // Caption/mô tả riêng cho media này
    private List<String> taggedUserIds; // Users được tag trong media này
    private Location location; // Location riêng cho media này (nếu khác với post chính)
    
    // Metadata bổ sung
    private String filter; // Filter/effect được áp dụng
    private MediaMetadata metadata; // Metadata EXIF, thông tin chi tiết
}
