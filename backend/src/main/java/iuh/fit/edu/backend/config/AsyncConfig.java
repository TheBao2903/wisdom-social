/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;


/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    // Được sử dụng để spring đẩy task vào threadPool 'wsExecutor'
    // Tránh block request khi chat nhiều user cùng lúc
    @Bean(name = "wsExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10); // Số luồng cơ bản
        executor.setMaxPoolSize(50);  // Số luồng tối đa khi tải cao
        executor.setQueueCapacity(1000); // Tối đa 1000 task chờ khi thread bận
        executor.setThreadNamePrefix("Async-WS-");
        executor.initialize();
        return executor;
    }
}
