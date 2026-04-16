package iuh.fit.edu.backend.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.domain.entity.mysql.PinnedMessageDetail;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

@Converter
public class PinnedMessagesConverter implements AttributeConverter<List<PinnedMessageDetail>, String> {

    // Tạo sẵn ObjectMapper và đăng ký module thời gian để serialize được Instant.
    // Nếu không có JavaTimeModule thì pinnedAt sẽ lỗi khi convert sang JSON và DB chỉ nhận "[]".
    private static final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Override
    public String convertToDatabaseColumn(List<PinnedMessageDetail> attribute) {
        try {
            return (attribute == null || attribute.isEmpty()) ? "[]" : objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    @Override
    public List<PinnedMessageDetail> convertToEntityAttribute(String dbData) {
        try {
            return (dbData == null || dbData.isEmpty()) ? new ArrayList<>() 
                    : objectMapper.readValue(dbData, new TypeReference<List<PinnedMessageDetail>>() {});
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }
}