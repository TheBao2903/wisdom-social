/*
 * @ (#) .java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;


/*
 * @description
 * @author: Huu Thai
 * @date:
 * @version: 1.0
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // Core Pool Size: Số lượng Thread luôn luôn duy trì trạng thái sẵn sàng chạy
        // Việc đẩy Redis là tác vụ I/O nhẹ, để 10-20 là đủ cho một server trung bình
        executor.setCorePoolSize(20);

        // Max Pool Size: Nếu số lượng task đến cùng lúc quá đông, được phép phình ra tối đa bao nhiêu Thread?
        executor.setMaxPoolSize(100);

        // Queue Capacity: Nếu cả 100 Thread đều đang bận, thì cho phép bao nhiêu task xếp hàng chờ?
        // Đặt 500 nghĩa là chịu được khoảng burst 500 tin nhắn gửi cùng lúc mà không rơi vãi
        executor.setQueueCapacity(500);

        // Đặt tên Thread để sau này đọc Log hoặc Monitor dễ bắt lỗi
        executor.setThreadNamePrefix("ChatEvent-Async-");

        // CHIẾN LƯỢC BẮT BUỘC KHI QUÁ TẢI (RejectedExecutionHandler)
        // Nếu Queue vượt quá 500 và Thread vượt 100 -> CallerRunsPolicy
        // Tức là: Không được vứt task đi, mà ép chính cái luồng API (Main Thread) phải tự đi mà chạy tác vụ này!
        // Việc này làm API bị chậm lại một chút lúc hệ thống đang kiệt sức, nhưng bảo đảm KHÔNG BAO GIỜ MẤT SỰ KIỆN.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());

        // Cài đặt thời gian sống cho các Thread dôi dư (Ngoài 20 Core) khi chúng nhàn rỗi (giây)
        executor.setKeepAliveSeconds(60);

        executor.initialize();
        return executor;
    }
}
