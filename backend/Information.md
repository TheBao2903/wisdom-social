Tầng 1 (Nhanh nhất - Danh sách tin nhắn): Lưu trọn vẹn cả nội dung, tên, avatar thành chuỗi JSON trong 1 List. Giải quyết 90% traffic.

Tầng 2 (Cache Đơn lẻ - Member Info): Dùng để truy xuất siêu tốc khi có 1 người vừa nhắn tin (để gán tên vào tin nhắn mới đó trong hàm sendMessage).

Tầng 3 (Dự phòng Bulk Query - DB): Cứu cánh vững chắc bằng câu lệnh IN tối ưu khi Cache Tầng 1 bị rỗng. Không làm chết DB bằng N+1.

BỨC TRANH KIẾN TRÚC TỔNG THỂ: MODULE LỊCH SỬ CHAT & QUẢN LÝ TIN NHẮN
Hệ thống được thiết kế theo mô hình Hybrid Database (MongoDB + MySQL) kết hợp với bộ nhớ đệm đa tầng (Multi-tiered Redis Cache), chịu tải cao và giải quyết triệt để các bài toán hóc búa về đồng bộ dữ liệu.

1. Chiến lược Bộ nhớ đệm "Cửa sổ trượt" (Sliding Window Cache)
   Thay vì bắt Database phải gánh mọi request tải tin nhắn, hệ thống áp dụng chiến lược lưu trữ cục bộ trên RAM cực kỳ tối ưu:

Tốc độ O(1): Chỉ giữ lại đúng 60 tin nhắn mới nhất của mỗi phòng chat trong Redis dưới dạng List. Khi có tin mới, đẩy vào đầu (leftPush) và tự động cắt đuôi (trim).

In-place Update (Cập nhật tại chỗ): Khi có thao tác "Thu hồi" hoặc "Xóa 1 phía", hệ thống không vứt bỏ toàn bộ Cache, mà lôi List 60 phần tử lên, quét tìm đúng ID, cập nhật trạng thái (thêm ID vào tập deletedFor hoặc đổi cờ isRecalled) và ghi đè lại. Tốc độ xử lý tính bằng micro-giây.

2. Xóa lịch sử trò chuyện (Time-Cut Strategy & Chống vòng lặp)
   Hệ thống không thực hiện xóa vật lý (Hard Delete) để đảm bảo tính toàn vẹn dữ liệu cho người dùng đối diện, mà sử dụng thuật toán "Cắt mốc thời gian" (Time-Cut):

Khi user bấm xóa, lưu mốc clearedAt xuống MySQL.

Tối ưu Cache (Write-Invalidate): Áp dụng triệt để nguyên tắc xóa Cache (@CacheEvict) thay vì cập nhật đè (@CachePut) cho MemberInfo. Điều này loại bỏ 100% rủi ro Race Condition (lỗi tương tranh) khi có độ trễ giữa DB và Redis.

Bảo vệ Network (Short-Circuit): Xây dựng thuật toán "Chặn đầu - Chặn đuôi" ở API phân trang. Khi phát hiện Frontend (React/Vue) yêu cầu lấy dữ liệu cũ hơn mốc clearedAt, Backend chủ động ngắt luồng, không chạm vào DB, và ép trả về hasNext = false. Kỹ thuật này triệt tiêu hoàn toàn rủi ro "Vòng lặp phân trang vô tận" (Infinite Pagination Loop) thường làm sập các ứng dụng chat.

3. Bộ lọc In-memory & Tối ưu Băng thông (Network Payload)
   Lọc động trên RAM: Thay vì viết các câu Query phức tạp ép DB phải lọc những tin bị xóa/thu hồi, hệ thống lấy dữ liệu nguyên bản lên và dùng Java Stream .filter() trên RAM dựa theo mốc clearedAt và tập deletedFor.

Zero-byte Overhead: Giải quyết mâu thuẫn giữa Jackson Serialization và Redis bằng @JsonInclude(NON_NULL). Dữ liệu bộ lọc (như deletedFor) được lưu giữ nguyên vẹn trên Redis để Backend xử lý, nhưng bị "tẩy xóa" hoàn toàn trước khi biến thành JSON trả về. Frontend nhận được một Response siêu nhẹ, tối ưu băng thông và không bị lộ ID người dùng khác.

4. Chống bão truy vấn "N+1 Query" (Tối ưu Fallback)
   Khi người dùng cuộn xem lịch sử quá khứ xa (Cache Miss), hệ thống chuyển sang luồng dự phòng (Fallback):

Bulk Fetching: Không lạm dụng Cache đơn lẻ (@Cacheable) trong vòng lặp để lấy tên/avatar người gửi, tránh thảm họa N+1 Query.

Gom nhóm: Thu thập toàn bộ ID người gửi trong mảng tin nhắn và chọc xuống MySQL bằng đúng 1 câu lệnh duy nhất (SELECT ... WHERE user_id IN (...)). Kỹ thuật này giúp hệ thống vẫn đứng vững ngay cả khi Cache bị thủng.

Bức tranh này phô diễn được tư duy phân tầng rõ rệt: Giao quyền gác cổng và tốc độ cho Redis, giao logic nghiệp vụ phức tạp cho RAM (Java Stream), và chỉ coi Database là chốt chặn lưu trữ cuối cùng.