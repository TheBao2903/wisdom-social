package iuh.fit.edu.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

// @SpringBootApplication
// Chỉ nhận những interface kế thừa JpaRepository là JPA
@EnableJpaRepositories(
        basePackages = "iuh.fit.edu.backend.modules",
        includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = org.springframework.data.jpa.repository.JpaRepository.class)
)
//// Chỉ nhận những interface kế thừa MongoRepository là MongoDB
@EnableMongoRepositories(
        basePackages = "iuh.fit.edu.backend.modules",
        includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = org.springframework.data.mongodb.repository.MongoRepository.class)
)
@SpringBootApplication(exclude = {
    org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration.class
})
@EnableScheduling
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }

}
