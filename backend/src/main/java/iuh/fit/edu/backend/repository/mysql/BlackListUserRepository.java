package iuh.fit.edu.backend.repository.mysql;

import iuh.fit.edu.backend.domain.entity.mysql.BlackListUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BlackListUserRepository extends JpaRepository<BlackListUser,Long> {
    @Query("""
       select count(b) > 0
       from BlackListUser b
       where b.idToken = :token
          or b.refreshToken = :token
    """)
    boolean existsByAnyToken(String token);
}
