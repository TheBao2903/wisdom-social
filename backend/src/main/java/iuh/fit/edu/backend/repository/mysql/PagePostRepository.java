package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.constant.PostStatus;
import iuh.fit.edu.backend.domain.entity.mysql.PagePost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;


@Repository
public interface PagePostRepository extends JpaRepository<PagePost,Long> {
    PagePost findByPostIdAndPage_Id(String postId, Long pageId);
    List<PagePost> findByPage_IdAndStatus(Long pageId, PostStatus status);

    PagePost findPagePostByPage_IdAndPostId(Long pageId, String postId);
}
