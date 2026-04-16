/*
 * @ (#) Location.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql.embeddable;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * @description: Location embeddable class (shared by Post, Story, Media)
 * @author: The Bao
 * @date: 2026-01-23
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Location {
    private String name; // Tên địa điểm
    private String address;
    private Double latitude;
    private Double longitude;
    private String placeId; // Google Places API ID
}
