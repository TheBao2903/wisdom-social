package iuh.fit.edu.backend.modules.user.repository;

import iuh.fit.edu.backend.modules.user.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SessionRepository extends JpaRepository<Session,String> {
}
