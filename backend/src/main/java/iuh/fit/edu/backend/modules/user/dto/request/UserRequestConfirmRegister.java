package iuh.fit.edu.backend.modules.user.dto.request;

import lombok.Data;

@Data
public class UserRequestConfirmRegister {
    private String phone;
    private String otp;
}
