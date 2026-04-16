/*
 * @ (#) MongoIndexConfig.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.util.concurrent.TimeUnit;

/**
 * @description: MongoDB Index Configuration
 * TTL auto-delete được BẬT cho Notes (24h) - Các entity khác giữ lại vĩnh viễn
 * expireAt field dùng để tự động xóa sau thời gian quy định
 * @author: Thế Bảo
 * @date: 2026-01-20
 * @version: 1.0
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class MongoIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void initIndexes() {
        log.info("Initializing MongoDB indexes...");

        try {
            // TTL AUTO-DELETE chỉ BẬT cho Notes - Tự động xóa sau 24h
            // Các entity khác (Story, Notification...) giữ lại trong database
            
            // Notes - 24 hours TTL - Tự động xóa sau 24h
            createTTLIndex("notes", "expireAt", 0, TimeUnit.SECONDS);

            /* COMMENT OUT TTL INDEXES cho các entity khác - Không xóa tự động
            // Story - 24 hours TTL
            createTTLIndex("stories", "expireAt", 24, TimeUnit.HOURS);

            // Story Views - 48 hours TTL
            createTTLIndex("story_views", "expireAt", 48, TimeUnit.HOURS);

            // Notifications - 90 days TTL
            createTTLIndex("notifications", "expireAt", 90, TimeUnit.DAYS);

            // Hashtag Trending - 30 days TTL
            createTTLIndex("hashtag_trending", "expireAt", 30, TimeUnit.DAYS);
            */

            log.info("MongoDB indexes initialized successfully (TTL enabled for Notes only)");
        } catch (Exception e) {
            log.error("Error initializing MongoDB indexes", e);
        }
    }

    /**
     * Tạo TTL index cho collection
     *
     * @param collectionName Tên collection
     * @param fieldName      Field chứa expire time
     * @param duration       Thời gian TTL
     * @param timeUnit       Đơn vị thời gian
     */
    
    private void createTTLIndex(String collectionName, String fieldName, long duration, TimeUnit timeUnit) {
        try {
            IndexOperations indexOps = mongoTemplate.indexOps(collectionName);

            // Tạo TTL index
            Index index = new Index()
                    .on(fieldName, Sort.Direction.ASC)
                    .expire(duration, timeUnit)
                    .named(fieldName + "_ttl_idx");

            // ensureIndex is deprecated but still functional and safe to use
            // Alternative: Manual index creation via MongoDB shell or migration scripts
            indexOps.createIndex(index);

            log.info("Created TTL index for collection '{}' on field '{}' with TTL {} {}",
                    collectionName, fieldName, duration, timeUnit.toString().toLowerCase());
        } catch (Exception e) {
            log.warn("Failed to create TTL index for collection '{}': {}",
                    collectionName, e.getMessage());
        }
    }
}
