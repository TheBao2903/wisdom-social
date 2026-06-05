package iuh.fit.edu.backend.modules.post.service;

import iuh.fit.edu.backend.modules.post.entity.Post;
import iuh.fit.edu.backend.modules.post.dto.request.CreatePostRequest;
import org.springframework.data.domain.Page;

import java.util.List;

/*
 * @description: Post service interface
 * @author: The Bao
 * @date: 31/01/2026
 * @version: 1.0
 */
public interface PostService {
    Post createPost(CreatePostRequest request, List<String> imageUrls, Long authorId);
    Page<Post> getPostsByUserId(Long userId, Long currentUserId, int page, int size);
    long countPostsByUserId(Long userId, Long currentUserId);
    Post getPostById(String postId);
    void deletePost(String postId, Long userId);
    Post updatePost(String postId, CreatePostRequest request, List<String> newImageUrls, Long userId);
    List<Post> getPostsByTaggedUserId(String userId);
    void syncAllPostsStats();
    Page<Post> getPostsByHashtag(String hashtag, Long currentUserId, int page, int size);
}
