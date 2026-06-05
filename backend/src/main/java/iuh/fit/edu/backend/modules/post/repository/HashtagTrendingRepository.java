package iuh.fit.edu.backend.modules.post.repository;

import iuh.fit.edu.backend.modules.post.entity.HashtagTrending;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HashtagTrendingRepository extends MongoRepository<HashtagTrending, String> {
    Optional<HashtagTrending> findByHashtag(String hashtag);
    Optional<HashtagTrending> findByHashtagAndPeriod(String hashtag, String period);
    Page<HashtagTrending> findByPeriod(String period, Pageable pageable);
    List<HashtagTrending> findTop10ByOrderByTrendingScoreDesc();
}
