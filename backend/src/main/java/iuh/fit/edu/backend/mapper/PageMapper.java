package iuh.fit.edu.backend.mapper;

import iuh.fit.edu.backend.domain.entity.mysql.Page;
import iuh.fit.edu.backend.dto.request.page.UserRequestCreatePage;
import iuh.fit.edu.backend.dto.request.page.UserRequestUpdatePage;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PageMapper {
    Page CreateRequestPagetoPage(UserRequestCreatePage createPage);
}
