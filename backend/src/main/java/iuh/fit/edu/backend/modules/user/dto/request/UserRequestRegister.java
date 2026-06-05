/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.user.dto.request;


import lombok.Data;

/*
 * @description
 * @author: Ngoc Hai
 * @date:
 * @version: 1.0
 */
@Data
public class UserRequestRegister {
    private String phone;
    private String password;
    private String confirmPassword;
    private String deviceType;
    private String deviceName;
    private String ipAddress;
}

