/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.mapper;

import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.dto.request.user.UserRequestRegister;
import iuh.fit.edu.backend.dto.response.user.UserResponseRegister;
import org.mapstruct.Mapper;

/*
 * @description
 * @author: Ngoc Hai
 * @date:
 * @version: 1.0
 */
@Mapper(componentModel = "spring")
public interface UserMapper {
    User UserRegistertoUser(UserRequestRegister register);
    UserResponseRegister UsertoUserRegisterResponse(User user);
}
