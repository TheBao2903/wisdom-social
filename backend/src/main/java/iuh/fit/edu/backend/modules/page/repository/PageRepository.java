package iuh.fit.edu.backend.modules.page.repository;

import iuh.fit.edu.backend.modules.page.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PageRepository extends JpaRepository<Page,Long> {
    Long id(Long id);
    List<Page> findByCreatedBy_Id(Long userId);
}
