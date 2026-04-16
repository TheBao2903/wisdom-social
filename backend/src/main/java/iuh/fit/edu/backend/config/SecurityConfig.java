/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.config;

import iuh.fit.edu.backend.config.filter.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS,"/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/ws-native/**").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/auth/confirm").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/auth/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.GET,"/api/session/qr-login/create").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/session/qr-login/confirm").permitAll()
                        .requestMatchers(HttpMethod.GET,"/api/session/qr-login/reject").permitAll()
                        .requestMatchers(HttpMethod.GET,"/api/session/qr-login/status/**").permitAll()
                        .requestMatchers(HttpMethod.GET,"/api/session/qr-login/access-token/**").permitAll()
                        .requestMatchers(HttpMethod.GET,"/api/session/qr-login/access-token").permitAll()
                        .requestMatchers(HttpMethod.PUT,"/api/auth/users/**").authenticated()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                );

        return http.build();
    }
}
