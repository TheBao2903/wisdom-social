/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.modules.user.mapper;

import iuh.fit.edu.backend.modules.user.entity.User;
import iuh.fit.edu.backend.modules.user.dto.request.UserRequestRegister;
import iuh.fit.edu.backend.modules.user.dto.response.UserResponseRegister;
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
