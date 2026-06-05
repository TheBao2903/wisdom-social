# Wisdom Social – Admin Console

Bảng điều khiển dành cho quản trị viên (`frontend-admin`) được xây dựng bằng:

- **React 19 + TypeScript + Vite**
- **TailwindCSS 4** (chỉ dùng tiện ích Tailwind, không CSS riêng)
- **React Router 7** (định tuyến SPA)
- **Recharts** (biểu đồ thống kê)
- **Lucide React** (icon)
- **Axios** (gọi API) + **react-hot-toast** (thông báo)

> Backend Spring Boot mặc định chạy trên `http://localhost:8080`. Vite dev server proxy `/api → 8080`.
> Khi backend không sẵn sàng, mọi service đều **fallback về dữ liệu mock** để UI vẫn hoạt động đầy đủ.

---

## 1. Cài đặt & chạy dự án

```bash
cd frontend-admin
npm install
npm run dev          # mở http://localhost:5174
```

Build production:

```bash
npm run build
npm run preview
```

### Tài khoản mặc định khi backend chưa có

Nếu backend chưa chạy, bạn vẫn có thể đăng nhập bằng tài khoản mock:

| Số điện thoại | Mật khẩu |
|---------------|----------|
| `admin`       | `admin123` |
| `0900000000`  | `admin123` |

Khi backend đã chạy, hãy đăng nhập bằng tài khoản admin thực tế (cùng cơ chế login với hai frontend còn lại).

---

## 2. Cấu trúc thư mục

```
frontend-admin/
├── src/
│   ├── api/               # axiosClient có interceptor refresh token
│   ├── components/
│   │   ├── common/        # ProtectedRoute, StatCard…
│   │   └── layout/        # Sidebar, Topbar, AdminLayout
│   ├── context/           # AuthContext
│   ├── mocks/             # 80 user, 24 page, posts, 200 log mock
│   ├── pages/             # Login, Dashboard, Users, Pages, Posts, Logs, Reports, Messages, Settings
│   ├── services/          # authService, userService, pageService, postService, adminService, logService
│   ├── types/             # Kiểu dữ liệu TypeScript khớp với backend
│   ├── utils/             # cookies helper
│   ├── App.tsx            # Routing
│   └── main.tsx           # Entry
├── ADMIN_GUIDE.md         # ← file này
└── vite.config.ts
```

---

## 3. Tính năng chính

| Trang | Đường dẫn | Mô tả |
|-------|-----------|-------|
| Đăng nhập | `/login` | Form đăng nhập số điện thoại + mật khẩu, hỗ trợ chế độ mock |
| Tổng quan (Dashboard) | `/` | KPI cards + 4 biểu đồ (đăng ký mới, giới tính, tương tác, top danh mục Page) + bảng người dùng mới + system health |
| Người dùng | `/users` | Danh sách tài khoản, lọc theo trạng thái, **Khoá / Mở khoá / Xoá**. Khoá yêu cầu nhập lý do. |
| Pages | `/pages` | Hiển thị grid card từng Page, xác minh, danh mục, trạng thái, xoá Page |
| Bài đăng | `/posts` | Chọn user → xem & kiểm duyệt bài đăng (xoá, hiển thị media, hashtags, thống kê reaction/comment/share) |
| **Nhật ký hoạt động (mới)** | `/logs` | 200 bản ghi mock, filter theo hành động/trạng thái/từ-đến ngày, biểu đồ, **xuất CSV**, xoá từng log hoặc xoá toàn bộ |
| Báo cáo / Vi phạm | `/reports` | Khung sẵn cho khi backend có `/api/admin/reports` |
| Hội thoại | `/messages` | Khung placeholder |
| Cấu hình | `/settings` | Thông tin tài khoản đang đăng nhập + thông tin môi trường |

### 3.1 Map tới Backend Spring Boot

| Trang | Endpoint backend |
|-------|------------------|
| Login | `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/refresh` |
| Logout | `POST /api/auth/logout` |
| Users | `GET/PUT/DELETE /api/auth/users{,/{id}}`, `GET /api/auth/users/username/{kw}` |
| Lock / Unlock | `POST /api/admin/lock/{userId}` body `{ reason }`, `POST /api/admin/unlock/{userId}` |
| Pages | `GET /api/page/all`, `GET /api/page/{id}`, `DELETE /api/page/delete/{id}` |
| Posts | `GET /api/posts/user/{userId}`, `GET /api/posts/{id}`, `DELETE /api/posts/{id}` |
| Logs | *(chưa có ở backend, đang dùng mock)* – đề xuất `GET /api/admin/logs` |

---

## 4. Dữ liệu mock

Tất cả nằm trong [src/mocks/mockData.ts](src/mocks/mockData.ts) và được sinh **deterministic** (LCG seeded) để mỗi lần load đều giống nhau, dễ test.

| Tập | Số lượng | Ghi chú |
|-----|----------|---------|
| `MOCK_USERS` | 80 | Tên Việt, gender ngẫu nhiên, ~12% bị khoá |
| `MOCK_PAGES` | 24 | 10 danh mục, ~30% verified, có cover & avatar |
| `MOCK_POSTS_BY_USER` | 2-9 / user | Có media (Picsum), hashtags, stats |
| `MOCK_LOGS` | **200** | 20 loại hành động, 3 mức trạng thái, IP / device / browser ngẫu nhiên, sort theo thời gian giảm dần |

### Cách thay đổi số lượng mock

```ts
// src/mocks/mockData.ts
export const MOCK_USERS = generateMockUsers(150);   // 150 user
export const MOCK_LOGS  = generateMockLogs(MOCK_USERS, 500); // 500 log
```

### Cơ chế fallback trong service

```ts
async getAllUsers(): Promise<User[]> {
  try {
    const res = await axiosClient.get('/auth/users');
    const list = unwrap<User[]>(res);
    if (Array.isArray(list) && list.length > 0) return list;
    return mockUsers;     // ← khi backend trả rỗng
  } catch {
    return mockUsers;     // ← khi backend lỗi mạng / 5xx
  }
}
```

→ Mọi thao tác **xoá / khoá / mở khoá / cập nhật** vẫn cập nhật in-memory mock, đảm bảo UI feel real.

---

## 5. Tính năng quản lý log

### 5.1 Mục đích

- **Audit trail**: ai đã làm gì, khi nào, từ thiết bị / IP nào.
- **Phát hiện bất thường**: lọc nhanh các `FAILED_LOGIN`, `LOCK_USER`, `REPORT_CONTENT`.
- **Truy vết sự cố** & xuất CSV để phân tích.

### 5.2 Các loại hành động (`LogAction`)

```
LOGIN, LOGOUT, REGISTER,
CREATE_POST, DELETE_POST, UPDATE_PROFILE,
PASSWORD_RESET, CHANGE_PASSWORD,
BLOCK_USER, UNBLOCK_USER,
SEND_FRIEND_REQUEST, ACCEPT_FRIEND_REQUEST,
CREATE_PAGE, DELETE_PAGE, JOIN_PAGE,
REPORT_CONTENT, UPLOAD_AVATAR,
LOCK_USER, UNLOCK_USER,
FAILED_LOGIN
```

### 5.3 Trạng thái

| Trạng thái | Màu | Khi nào |
|------------|-----|---------|
| `SUCCESS` | xanh emerald | Hành động thành công |
| `WARNING` | vàng amber | Cảnh báo (báo cáo nội dung, bị khoá…) |
| `FAILED` | đỏ rose | Lỗi (chủ yếu `FAILED_LOGIN`) |

### 5.3.1 API endpoint kèm theo log

Mỗi bản ghi log lưu **đúng endpoint backend Spring Boot** mà người dùng đã gọi, kèm
**HTTP method** và **HTTP response status** — giúp truy vết nhanh hành vi qua API gateway / log server.

| Hành động | Method | Endpoint backend tương ứng |
|-----------|--------|----------------------------|
| LOGIN / FAILED_LOGIN | POST | `/api/auth/login` |
| LOGOUT | POST | `/api/auth/logout` |
| REGISTER | POST | `/api/auth/register` |
| UPDATE_PROFILE | PUT | `/api/auth/users/:userId` |
| PASSWORD_RESET / CHANGE_PASSWORD | POST | `/api/auth/reset-password` |
| BLOCK_USER | POST | `/api/auth/users/block` |
| UNBLOCK_USER | POST | `/api/auth/users/cancel-block` |
| UPLOAD_AVATAR | GET | `/api/auth/users/update/upload-avatar` |
| CREATE_POST | POST | `/api/posts` |
| DELETE_POST | DELETE | `/api/posts/:postId` |
| SEND_FRIEND_REQUEST | POST | `/api/friends/request` |
| ACCEPT_FRIEND_REQUEST | POST | `/api/friends/accept` |
| CREATE_PAGE | POST | `/api/page/create` |
| DELETE_PAGE | DELETE | `/api/page/delete/:pageId` |
| JOIN_PAGE | POST | `/api/page-member/request-join` |
| LOCK_USER | POST | `/api/admin/lock/:userId` |
| UNLOCK_USER | POST | `/api/admin/unlock/:userId` |
| REPORT_CONTENT | POST | `/api/reports` *(dự kiến)* |

→ UI hiển thị badge màu theo method (`GET` xanh / `POST` xanh lá / `PUT` vàng / `DELETE` đỏ /
`PATCH` tím) và badge màu theo HTTP status (2xx xanh / 4xx vàng / 5xx đỏ).
→ Bảng có **bộ lọc HTTP method**, biểu đồ **Top API được gọi** (8 endpoint hot nhất),
và phân bố theo HTTP method.

### 5.4 Đề xuất schema backend tương lai

```sql
CREATE TABLE user_activity_logs (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT NOT NULL,
  action          VARCHAR(64) NOT NULL,
  description     VARCHAR(512),
  status          VARCHAR(16) NOT NULL,    -- SUCCESS / WARNING / FAILED
  http_method     VARCHAR(8),              -- GET / POST / PUT / DELETE / PATCH
  api_endpoint    VARCHAR(255),            -- ví dụ /api/auth/login
  response_status SMALLINT,                -- HTTP status code (200, 401, 500…)
  ip_address      VARCHAR(45),
  device          VARCHAR(64),
  browser         VARCHAR(64),
  created_at      DATETIME(3) NOT NULL,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_action_status (action, status),
  INDEX idx_endpoint (api_endpoint)
);
```

Endpoints gợi ý:

```
GET    /api/admin/logs?keyword=&action=&status=&from=&to=&page=&size=
DELETE /api/admin/logs/{id}
DELETE /api/admin/logs           # clear all
GET    /api/admin/logs/export    # CSV
GET    /api/admin/logs/stats     # số liệu cho biểu đồ
```

Khi backend implement xong, chỉ cần thay phần thân hàm trong
[src/services/logService.ts](src/services/logService.ts) bằng các call axios tương ứng –
toàn bộ UI Logs (`/logs`) sẽ chạy không sửa gì thêm.

---

## 6. Test cases

> Có thể test thủ công ngay (UI sẵn). Khi muốn tự động hoá, dùng Vitest + React Testing Library
> (chưa cấu hình mặc định để giữ dependency tối thiểu).

### 6.1 Đăng nhập

| # | Tình huống | Bước | Kết quả mong đợi |
|---|-----------|------|------------------|
| TC-AUTH-01 | Login mock thành công | Nhập `admin / admin123` → Submit | Toast "Đăng nhập thành công", chuyển hướng `/` |
| TC-AUTH-02 | Login khi backend chạy | Nhập tài khoản admin thật | API `/auth/login` trả token, lưu cookie `accessToken`, chuyển hướng `/` |
| TC-AUTH-03 | Sai mật khẩu | `admin / wrong` | Toast lỗi, không chuyển hướng |
| TC-AUTH-04 | Bỏ trống | Submit khi rỗng | Toast "Vui lòng nhập số điện thoại và mật khẩu" |
| TC-AUTH-05 | Đăng xuất | Bấm "Đăng xuất" trên topbar | Xoá cookie + localStorage, redirect `/login` |
| TC-AUTH-06 | Truy cập route bảo vệ khi chưa login | Mở `/users` ở tab ẩn danh | Redirect `/login` |

### 6.2 Người dùng (`/users`)

| # | Tình huống | Bước | Kết quả mong đợi |
|---|-----------|------|------------------|
| TC-USR-01 | Tải danh sách | Mở `/users` | Hiển thị 80 dòng (mock), spinner biến mất < 1s |
| TC-USR-02 | Tìm theo tên | Gõ "Nguyễn" trong ô search | Bảng lọc client-side ngay lập tức |
| TC-USR-03 | Filter "Bị khoá" | Bấm chip "Bị khoá" | Chỉ hiển thị user có `locked = true` |
| TC-USR-04 | Khoá user | "Khoá" → nhập lý do → Xác nhận | Toast thành công, badge "Đang khoá" hiển thị, lý do xuất hiện dưới badge |
| TC-USR-05 | Mở khoá user | Bấm "Mở khoá" trên user đang khoá | Toast thành công, badge chuyển "Hoạt động" |
| TC-USR-06 | Xoá user | "Xoá" → Confirm | User biến mất khỏi bảng, tổng số giảm 1 |
| TC-USR-07 | Hủy modal khoá | Mở modal khoá → "Huỷ" | Modal đóng, user không bị khoá |

### 6.3 Pages (`/pages`)

| # | Tình huống | Bước | Kết quả mong đợi |
|---|-----------|------|------------------|
| TC-PG-01 | Hiển thị grid | Mở `/pages` | Đủ 24 card có cover ảnh ngẫu nhiên |
| TC-PG-02 | Tìm theo danh mục | Gõ "Công nghệ" | Chỉ hiển thị Page thuộc danh mục đó |
| TC-PG-03 | Verified badge | Quan sát các card | Page có `isVerified = true` hiển thị icon ✓ xanh |
| TC-PG-04 | Xoá Page | Bấm "Xoá" + Confirm | Card biến mất, toast thành công |

### 6.4 Bài đăng (`/posts`)

| # | Tình huống | Bước | Kết quả mong đợi |
|---|-----------|------|------------------|
| TC-PS-01 | Chuyển user | Click 1 user khác trong sidebar | Bài đăng load lại theo userId |
| TC-PS-02 | Render media | User có post chứa media | Hiển thị grid 2-3 cột ảnh |
| TC-PS-03 | Xem stats | Quan sát footer post | Hiển thị reaction / comment / share |
| TC-PS-04 | Xoá post | "Xoá" → Confirm | Post biến mất, danh sách cập nhật ngay |

### 6.5 Logs (`/logs`)  — **trọng tâm test**

| # | Tình huống | Bước | Kết quả mong đợi |
|---|-----------|------|------------------|
| TC-LOG-01 | Tải mặc định | Mở `/logs` | 4 stat cards + 3 biểu đồ + bảng 20 dòng đầu (tổng 200) |
| TC-LOG-02 | Phân trang | Bấm "Sau" | Trang chuyển 1 → 2, danh sách thay đổi |
| TC-LOG-03 | Filter theo hành động | Chọn `LOGIN` → "Tìm kiếm" | Tất cả dòng có cột Hành động = `LOGIN` |
| TC-LOG-04 | Filter theo trạng thái | Chọn `FAILED` | Hiển thị các log đăng nhập thất bại |
| TC-LOG-05 | Filter ngày | From = 7 ngày trước, To = hôm nay → "Tìm kiếm" | Không có log nằm ngoài khoảng |
| TC-LOG-06 | Tìm keyword | Gõ một username vào ô search | Bảng chỉ chứa log của user đó |
| TC-LOG-07 | Đặt lại bộ lọc | Bấm "Đặt lại" | Tất cả filter rỗng, danh sách trở về mặc định |
| TC-LOG-08 | Xoá 1 log | Bấm "Xoá" trên 1 dòng | Toast "Đã xoá log", tổng giảm 1, biểu đồ cập nhật |
| TC-LOG-09 | Xuất CSV | Bấm "Xuất CSV" | File `wisdom-social-logs-YYYY-MM-DD.csv` tải về, mở được trong Excel |
| TC-LOG-10 | Xoá toàn bộ | "Xoá tất cả" → Confirm | Bảng trống, total = 0, biểu đồ rỗng |
| TC-LOG-11 | Trạng thái icon | Quan sát cột Trạng thái | `SUCCESS` ✓, `WARNING` ⚠️, `FAILED` ✕ với màu tương ứng |
| TC-LOG-12 | Sắp xếp thời gian | Quan sát cột Thời gian | Mới nhất ở trên, giảm dần |
| TC-LOG-13 | Top hành động chart | Mở trang lần đầu | Chart vertical bar liệt kê 8 hành động phổ biến nhất |
| TC-LOG-14 | Cột API hiển thị endpoint | Quan sát mọi dòng | Có badge method (GET/POST/PUT/DELETE) + endpoint + badge HTTP status |
| TC-LOG-15 | Lọc theo HTTP method | Chọn `DELETE` → "Tìm kiếm" | Chỉ hiển thị log có method DELETE (xoá post / xoá page) |
| TC-LOG-16 | Tìm theo endpoint | Gõ `/api/auth/login` vào ô search | Bảng chỉ còn log có endpoint chứa `/api/auth/login` |
| TC-LOG-17 | Top API chart | Quan sát panel "Top API được gọi" | Liệt kê 8 endpoint với progress bar tỷ lệ tương đối |
| TC-LOG-18 | CSV có cột API | Mở file CSV xuất ra | Có 3 cột mới: `method`, `endpoint`, `responseStatus` |

### 6.6 Dashboard (`/`)

| # | Tình huống | Kết quả mong đợi |
|---|-----------|------------------|
| TC-DSB-01 | KPI cards | Hiển thị 4 chỉ số (tổng user, active hôm nay, tổng page, user khoá) |
| TC-DSB-02 | Biểu đồ đăng ký | Area chart 14 ngày, hover hiện tooltip |
| TC-DSB-03 | Pie giới tính | Có 3 cung Nam / Nữ / Khác |
| TC-DSB-04 | Top danh mục Page | Bar chart vertical, đúng max 6 danh mục |
| TC-DSB-05 | Bảng user mới | Tối đa 6 dòng, sắp xếp createdAt giảm dần |

### 6.7 Bảo mật / điều hướng

| # | Tình huống | Kết quả mong đợi |
|---|-----------|------------------|
| TC-NAV-01 | Reload khi đang login mock | Cookie `accessToken` còn → vẫn ở dashboard |
| TC-NAV-02 | Cookie hết hạn | `accessToken` bị xoá thủ công → next API → redirect `/login` |
| TC-NAV-03 | Truy cập route không tồn tại | Mở `/abc` | Redirect `/` |

---

## 7. Mẹo phát triển tiếp

- **Thêm trang mới**: tạo file ở `src/pages`, đăng ký route trong `App.tsx`, thêm item trong `Sidebar.tsx`.
- **Đổi theme màu chính**: tìm `indigo-` / `purple-` trong codebase và đổi sang token màu khác (ví dụ `emerald-`).
- **Tích hợp realtime**: bổ sung WebSocket vào `axiosClient` (xem cách `frontend-web` dùng `@stomp/stompjs`).
- **Bật ESLint trong CI**: `npm run lint`.

---

## 8. Khắc phục sự cố

| Hiện tượng | Cách xử lý |
|-----------|-----------|
| Trang trắng sau `npm run dev` | Đảm bảo Node ≥ 22.13. Xoá `node_modules`, chạy lại `npm install`. |
| Login bị 401 ngay | Backend chạy nhưng không có user → dùng tài khoản mock `admin/admin123` để vào. |
| Biểu đồ không render | Kiểm tra console — thường do `recharts` thiếu kích thước cha. Đảm bảo container có chiều cao cố định. |
| API trả 401 mỗi request | Cookie `accessToken` đã hết hạn và refresh fail. Logout + login lại. |

---

© 2026 Wisdom Social. Internal use only.
