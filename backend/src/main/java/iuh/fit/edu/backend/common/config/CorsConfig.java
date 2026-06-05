/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Configuration
public class CorsConfig {
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:5173",
                "http://localhost:5174",// Web frontend (dev)
                "http://localhost:4173",     // Web frontend (preview)
                "http://localhost:8081",     // Mobile Expo dev server
                "http://localhost:19000",    // Expo Go
                "http://localhost:19006",    // Expo web
                "http://192.168.1.151:8081",
                "http://192.168.5.66:5173",// Mobile Expo from IP
                "http://192.168.1.153:8081",
                "http://192.168.5.60:8081", // Mobile Expo from IP
                "http://192.168.1.153:19000", // Mobile Expo from IP
                "http://192.168.5.60:19000",
                "http://192.168.1.151:19000",
                "http://172.20.10.2:8081", 
                "https://wisdom-social.vercel.app"// Expo Go from IP

        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")); // Allowed methods
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept", "x-no-retry", "X-Client"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        configuration.addExposedHeader("Set-Cookie");
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
