/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import iuh.fit.edu.backend.common.event.subscriber.RedisChatSubscriber;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
// Dùng redis để làm trạm trung chuyển nhận/bắn dữ liệu
@Configuration
@RequiredArgsConstructor
public class RedisPubSubConfig {

    public static final String CHAT_CHANNEL = "chat_realtime_channel";
    public static final String NOTIFICATION_CHANNEL = "notification_realtime_channel";
    public static final String POST_CHANNEL = "post_realtime_channel";
    public static final String COMMENT_CHANNEL = "comment_realtime_channel";
    public static final String REACT_CHANNEL = "react_realtime_channel";

    // 1. Tạo một Mapper SẠCH: KHÔNG bật activateDefaultTyping
    @Bean
    @Primary
    public ObjectMapper pubSubObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    // 2. Tạo Template SẠCH để Publisher bắn dữ liệu lên Redis không bị dính Array
    @Bean
    public RedisTemplate<String, Object> pubSubRedisTemplate(RedisConnectionFactory factory, ObjectMapper pubSubObjectMapper) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        Jackson2JsonRedisSerializer<Object> serializer = new Jackson2JsonRedisSerializer<>(pubSubObjectMapper, Object.class);
        template.setValueSerializer(serializer);
        return template;
    }

    // 3. Adapter SẠCH để Subscriber nhận JSON thuần túy
    @Bean
    public MessageListenerAdapter listenerAdapter(RedisChatSubscriber subscriber, ObjectMapper pubSubObjectMapper) {
        MessageListenerAdapter adapter = new MessageListenerAdapter(subscriber, "onMessageReceived");
        Jackson2JsonRedisSerializer<Object> serializer = new Jackson2JsonRedisSerializer<>(pubSubObjectMapper, Object.class);
        adapter.setSerializer(serializer);
        return adapter;
    }

    @Bean
    public RedisMessageListenerContainer redisContainer(RedisConnectionFactory connectionFactory, MessageListenerAdapter listenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, new ChannelTopic(CHAT_CHANNEL));
        container.addMessageListener(listenerAdapter, new ChannelTopic(NOTIFICATION_CHANNEL));
        container.addMessageListener(listenerAdapter, new ChannelTopic(POST_CHANNEL));
        container.addMessageListener(listenerAdapter, new ChannelTopic(COMMENT_CHANNEL));
        container.addMessageListener(listenerAdapter, new ChannelTopic(REACT_CHANNEL));
        return container;
    }
}
