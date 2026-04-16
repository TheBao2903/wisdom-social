/*
 * @ (#) PostService.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.service.post;

import iuh.fit.edu.backend.domain.entity.nosql.Post;
import iuh.fit.edu.backend.dto.request.post.CreatePostRequest;

import java.util.List;

/*
 * @description: Post service interface
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
public interface PostService {
    Post createPost(CreatePostRequest request, List<String> imageUrls, Long authorId);
    List<Post> getPostsByUserId(Long userId);
    Post getPostById(String postId);
    void deletePost(String postId, Long userId);
    Post updatePost(String postId, CreatePostRequest request, List<String> newImageUrls, Long userId);
    List<Post> getPostsByTaggedUserId(String userId);
    void syncAllPostsStats();
}
