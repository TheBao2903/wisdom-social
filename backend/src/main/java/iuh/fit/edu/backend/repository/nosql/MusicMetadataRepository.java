package iuh.fit.edu.backend.repository.nosql;

import iuh.fit.edu.backend.domain.entity.nosql.MusicMetadata;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicMetadataRepository extends MongoRepository<MusicMetadata, String> {
    List<MusicMetadata> findByTitleContainingIgnoreCase(String title);
    List<MusicMetadata> findByArtistContainingIgnoreCase(String artist);
    Page<MusicMetadata> findAll(Pageable pageable);
}
