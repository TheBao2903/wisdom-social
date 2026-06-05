package iuh.fit.edu.backend.common.util.convert;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.modules.conversation.entity.FrozenLastMessage;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Converter
public class FrozenLastMessageConverter implements AttributeConverter<FrozenLastMessage, String> {

    private static final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Override
    public String convertToDatabaseColumn(FrozenLastMessage attribute) {
        try {
            // Khác với PinnedMessage (là List -> trả về "[]"), ở đây là Object -> trả về null
            return attribute == null ? null : objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            log.error("Lỗi khi convert FrozenLastMessage sang JSON String", e);
            return null;
        }
    }

    @Override
    public FrozenLastMessage convertToEntityAttribute(String dbData) {
        try {
            return (dbData == null || dbData.trim().isEmpty()) ? null 
                    : objectMapper.readValue(dbData, FrozenLastMessage.class);
        } catch (JsonProcessingException e) {
            log.error("Lỗi khi parse JSON String thành FrozenLastMessage", e);
            return null;
        }
    }
}