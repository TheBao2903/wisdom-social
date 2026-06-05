package iuh.fit.edu.backend.common.config;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.repository.ActiveTokenRepository;
import iuh.fit.edu.backend.modules.user.repository.DeviceRepository;
import iuh.fit.edu.backend.modules.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminDeleteUserRequest;

import java.time.OffsetDateTime;
import java.util.List;

@Component
public class AccountDeletionScheduler {

    private final UserRepository userRepository;
    private final DeviceRepository deviceRepository;
    private final ActiveTokenRepository activeTokenRepository;
    private final CognitoIdentityProviderClient cognitoClient;

    @Value("${aws.cognito.userPoolId}")
    private String userPoolId;

    public AccountDeletionScheduler(UserRepository userRepository,
                                    DeviceRepository deviceRepository,
                                    ActiveTokenRepository activeTokenRepository,
                                    CognitoIdentityProviderClient cognitoClient) {
        this.userRepository = userRepository;
        this.deviceRepository = deviceRepository;
        this.activeTokenRepository = activeTokenRepository;
        this.cognitoClient = cognitoClient;
    }

    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void deleteOverdueAccounts() {
        List<User> overdueUsers = userRepository.findByDeletionScheduledForBefore(OffsetDateTime.now());
        for (User user : overdueUsers) {
            try {
                String phone = "+84" + user.getPhone().substring(1, 10);
                cognitoClient.adminDeleteUser(AdminDeleteUserRequest.builder()
                        .userPoolId(userPoolId)
                        .username(phone)
                        .build());
            } catch (Exception e) {
                System.out.println("Failed to delete Cognito user for " + user.getPhone() + ": " + e.getMessage());
            }

            deviceRepository.deleteDeviceByUser_Id(user.getId());
            activeTokenRepository.deleteByUserId(user.getId());
            userRepository.deleteById(user.getId());
            System.out.println("Permanently deleted user: " + user.getPhone());
        }
    }
}
