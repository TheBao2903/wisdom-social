package iuh.fit.edu.backend.common.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "ai.provider")
public class AIProperties {
    private String baseUrl;
    private String apiKey;
    private String model;
    private Duration timeout = Duration.ofSeconds(30);
}
