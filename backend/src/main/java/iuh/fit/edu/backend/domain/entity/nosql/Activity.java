/*
 * @ (#) Activity.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.domain.entity.nosql;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * @description: Activity entity for Post (feeling/activity)
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Activity {
    private String type; // feeling | activity
    private String name; // happy | excited | watching | eating...
    private String iconUrl;
    private String description;
}
