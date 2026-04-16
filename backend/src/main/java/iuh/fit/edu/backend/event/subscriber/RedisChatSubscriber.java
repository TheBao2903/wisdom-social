/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.event.subscriber;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.edu.backend.event.handler.RedisEventHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
// Nơi nhận dữ liệu từ spring event và là trạm trung chuyển gửi dữ liệu đi
@Component
@Slf4j
public class RedisChatSubscriber {

    private final Map<String, RedisEventHandler> handlerMap;
    private final ObjectMapper pubSubObjectMapper;

    public RedisChatSubscriber(List<RedisEventHandler> handlers, @Qualifier("pubSubObjectMapper") ObjectMapper pubSubObjectMapper) {
        this.pubSubObjectMapper = pubSubObjectMapper;
        this.handlerMap = handlers.stream()
                .collect(Collectors.toMap(RedisEventHandler::getSupportedEventType, Function.identity()));
    }

    public void onMessageReceived(Object incomingData) {
        if (incomingData instanceof java.util.LinkedHashMap) {
            Map<String, Object> mapPayload = (Map<String, Object>) incomingData;

            String eventTypeStr = (String) mapPayload.get("domainEventType");
            if (eventTypeStr == null) return;

            RedisEventHandler handler = handlerMap.get(eventTypeStr);
            if (handler != null) {
                Set<Long> targetIds = null;
                if (mapPayload.get("targetMemberIds") != null) {
                    targetIds = pubSubObjectMapper.convertValue(
                            mapPayload.get("targetMemberIds"),
                            new TypeReference<Set<Long>>() {}
                    );
                }

                Object rawPayload = mapPayload.get("payload");
                Object realEvent = pubSubObjectMapper.convertValue(rawPayload, handler.getSupportedClass());

                handler.handle(realEvent, targetIds);
            } else {
                log.warn("Không tìm thấy Handler cho Sự kiện: {}", eventTypeStr);
            }
        }
    }
}
