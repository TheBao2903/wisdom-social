package iuh.fit.edu.backend.modules.page.mapper;

import iuh.fit.edu.backend.modules.page.entity.Page;
import iuh.fit.edu.backend.modules.page.dto.request.UserRequestCreatePage;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PageMapper {
    Page CreateRequestPagetoPage(UserRequestCreatePage createPage);
}
