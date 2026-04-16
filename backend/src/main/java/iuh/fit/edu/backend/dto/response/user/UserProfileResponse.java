package iuh.fit.edu.backend.dto.response.user;

import iuh.fit.edu.backend.constant.Gender;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/*
 * @description: Repository for Follow entity
 * @author: The Bao
 * @date: 2026-03-19
 * @versio:n 1.0
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    
    // Basic info
    private Long id;
    private String phone;
    private String name;
    private String username;
    private String avatarUrl;
    private String birthday;
    private String bio;
    private Gender gender;
    
    // Timestamps
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    
    // Dynamic Statistics
    private Long friendCount;     
    private Long followerCount;    
    private Long followingCount; 
    private Long postCount;        
}