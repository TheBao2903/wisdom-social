package iuh.fit.edu.backend.common.config;

import iuh.fit.edu.backend.modules.post.entity.Post;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class MongoMigrationConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void migrateLastActivityAt() {
        log.info("🚀 Checking for posts needing lastActivityAt migration...");
        
        Query query = new Query(Criteria.where("lastActivityAt").exists(false));
        List<Post> postsToUpdate = mongoTemplate.find(query, Post.class);
        
        if (postsToUpdate.isEmpty()) {
            log.info("✅ No posts found needing lastActivityAt migration.");
            return;
        }
        
        log.info("📦 Found {} posts to migrate. Starting batch update...", postsToUpdate.size());
        
        int updatedCount = 0;
        for (Post post : postsToUpdate) {
            try {
                Update update = new Update();
                // Fallback to createdAt, if null then now
                update.set("lastActivityAt", post.getCreatedAt() != null ? post.getCreatedAt() : java.time.Instant.now());
                
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(post.getId())),
                    update,
                    Post.class
                );
                updatedCount++;
            } catch (Exception e) {
                log.error("❌ Failed to migrate post {}: {}", post.getId(), e.getMessage());
            }
        }
        
        log.info("🎉 Migration completed. Updated {} posts.", updatedCount);
    }
}
