package iuh.fit.edu.backend.dto.request.user;

import lombok.Data;

@Data
public class UserRequestConfirmRegister {
    private String phone;
    private String otp;
}
