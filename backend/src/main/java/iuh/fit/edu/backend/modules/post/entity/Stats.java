/*
 * @ (#) Stats.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * @description: Stats entity for Post
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Stats {
    private long reactCount;
    private long commentCount;
    private long replyCount; // To track replies separately from top-level comments
    private long friendCommentCount; // To track comments from friends for engagement boost
    private long shareCount;
    private long viewCount; // View count cho video
}
