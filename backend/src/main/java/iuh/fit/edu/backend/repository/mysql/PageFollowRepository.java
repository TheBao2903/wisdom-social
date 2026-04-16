package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.PageFollow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PageFollowRepository extends JpaRepository<PageFollow,Long> {
    PageFollow findPageFollowByUser_IdAndPage_Id(Long userId, Long pageId);
    boolean existsByUser_IdAndPage_Id(Long userId, Long pageId);
    long countByPage_Id(Long pageId);
}
