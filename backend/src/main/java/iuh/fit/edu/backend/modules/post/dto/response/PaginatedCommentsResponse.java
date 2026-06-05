/*
 * @ (#) PaginatedCommentsResponse.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.post.dto.response;

import iuh.fit.edu.backend.modules.post.dto.response.CommentResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/*
 * @description: Response DTO for paginated comments
 * @author: The Bao
 * @date: 2026-04-09
 * @version: 1.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaginatedCommentsResponse {
    
    private List<CommentResponse> data;
    private boolean hasMore;
    private String nextCursor;
    private int totalCount;
}
