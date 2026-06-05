package iuh.fit.edu.backend.modules.post.service.impl;

import iuh.fit.edu.backend.modules.post.entity.Post;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataMigrationComponent {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void migrateRankingTime() {
        log.info("Checking for posts missing rankingTime...");
        Query query = new Query(Criteria.where("rankingTime").exists(false));
        List<Post> postsToUpdate = mongoTemplate.find(query, Post.class);
        
        if (!postsToUpdate.isEmpty()) {
            log.info("Found {} posts missing rankingTime. Migrating now...", postsToUpdate.size());
            for (Post post : postsToUpdate) {
                post.recalculateRankingTime();
                mongoTemplate.save(post);
            }
            log.info("Migration complete!");
        } else {
            log.info("No posts require rankingTime migration.");
        }
    }
}
