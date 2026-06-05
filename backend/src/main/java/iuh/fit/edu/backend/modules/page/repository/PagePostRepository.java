package iuh.fit.edu.backend.modules.page.repository;

import iuh.fit.edu.backend.modules.post.constant.PostStatus;
import iuh.fit.edu.backend.modules.page.entity.PagePost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;


@Repository
public interface PagePostRepository extends JpaRepository<PagePost,Long> {
    PagePost findByPostIdAndPage_Id(String postId, Long pageId);
    List<PagePost> findByPage_IdAndStatus(Long pageId, PostStatus status);

    PagePost findPagePostByPage_IdAndPostId(Long pageId, String postId);
}
