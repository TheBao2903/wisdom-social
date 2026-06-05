-- ============================================================
-- Wisdom Social - Test Data for MariaDB
-- Run this AFTER the app has created tables (ddl-auto=update)
-- ============================================================

-- Disable FK checks during insert
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data (optional - uncomment if needed)
-- TRUNCATE TABLE conversation_pins;
-- TRUNCATE TABLE group_join_requests;
-- TRUNCATE TABLE conversation_members;
-- TRUNCATE TABLE conversations;
-- TRUNCATE TABLE blocked_users;
-- TRUNCATE TABLE page_posts;
-- TRUNCATE TABLE page_likes;
-- TRUNCATE TABLE page_follows;
-- TRUNCATE TABLE page_members;
-- TRUNCATE TABLE pages;
-- TRUNCATE TABLE follows;
-- TRUNCATE TABLE friends;
-- TRUNCATE TABLE notification_settings;
-- TRUNCATE TABLE user_settings;
-- TRUNCATE TABLE device_settings;
-- TRUNCATE TABLE devices;
-- TRUNCATE TABLE active_tokens;
-- TRUNCATE TABLE sessions;
-- TRUNCATE TABLE black_list_users;
-- TRUNCATE TABLE colors;
-- TRUNCATE TABLE users;

-- ============================================================
-- 1. USERS (20 users)
-- Note: No password field - auth via AWS Cognito
-- ============================================================
INSERT INTO users (id, phone, name, username, avatar_url, birthday, bio, gender, created_at, updated_at, confirm_use_ai, last_active_at, locked, locked_at, lock_reason, locked_until, locked_by, deletion_requested_at, deletion_scheduled_for, pin_code) VALUES
-- Admin user
(1,  '0901000001', 'Admin Hệ Thống',     'admin',        'https://i.pravatar.cc/150?u=admin',    '1990-01-15', 'Quản trị viên hệ thống Wisdom Social', 'MALE',   '2025-01-01 00:00:00+07:00', '2026-05-29 08:00:00+07:00', 1, '2026-05-29 10:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, '123456'),

-- Active regular users
(2,  '0901000002', 'Nguyễn Văn An',       'nguyenvanan',  'https://i.pravatar.cc/150?u=an',       '1995-03-20', 'Yêu công nghệ, thích du lịch 🌍',     'MALE',   '2025-06-15 10:30:00+07:00', '2026-05-28 14:20:00+07:00', 0, '2026-05-28 14:20:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3,  '0901000003', 'Trần Thị Bình',       'tranthibinh',  'https://i.pravatar.cc/150?u=binh',     '1998-07-12', 'Designer | Coffee lover ☕',            'FEMALE', '2025-07-20 08:15:00+07:00', '2026-05-29 09:00:00+07:00', 1, '2026-05-29 09:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(4,  '0901000004', 'Lê Hoàng Cường',      'lehoangcuong', 'https://i.pravatar.cc/150?u=cuong',    '1993-11-05', 'Software Engineer tại Sài Gòn',        'MALE',   '2025-08-10 16:45:00+07:00', '2026-05-27 22:10:00+07:00', 1, '2026-05-27 22:10:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(5,  '0901000005', 'Phạm Thị Duyên',      'phamthiduyen', 'https://i.pravatar.cc/150?u=duyen',    '2000-02-14', 'Sinh viên CNTT | Love coding 💻',      'FEMALE', '2025-09-01 12:00:00+07:00', '2026-05-29 07:30:00+07:00', 0, '2026-05-29 07:30:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(6,  '0901000006', 'Hoàng Minh Đức',      'hoangminhduc', 'https://i.pravatar.cc/150?u=duc',      '1997-05-30', 'Photographer | Travel blogger',         'MALE',   '2025-10-12 09:20:00+07:00', '2026-05-28 18:45:00+07:00', 0, '2026-05-28 18:45:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(7,  '0901000007', 'Võ Thị Giang',        'vothigiang',   'https://i.pravatar.cc/150?u=giang',    '1999-08-22', 'Marketing Specialist 📊',              'FEMALE', '2025-11-05 14:30:00+07:00', '2026-05-29 06:15:00+07:00', 0, '2026-05-29 06:15:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(8,  '0901000008', 'Đỗ Quang Huy',        'doquanghuy',   'https://i.pravatar.cc/150?u=huy',      '1994-12-01', 'Full-stack Developer',                 'MALE',   '2025-12-20 11:00:00+07:00', '2026-05-26 20:30:00+07:00', 0, '2026-05-26 20:30:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(9,  '0901000009', 'Bùi Thị Hạnh',        'buithihanh',   'https://i.pravatar.cc/150?u=hanh',     '2001-04-18', 'Foodie 🍜 | Book worm 📚',             'FEMALE', '2026-01-10 07:45:00+07:00', '2026-05-29 08:00:00+07:00', 0, '2026-05-29 08:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(10, '0901000010', 'Ngô Thanh Khoa',      'ngothanhkhoa', 'https://i.pravatar.cc/150?u=khoa',     '1996-09-10', 'Data Scientist | AI Enthusiast 🤖',    'MALE',   '2026-01-25 13:15:00+07:00', '2026-05-28 16:00:00+07:00', 0, '2026-05-28 16:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- Users created recently (for "new this week" stats)
(11, '0901000011', 'Trương Thị Lan',      'truongthilan', 'https://i.pravatar.cc/150?u=lan',      '2002-06-25', 'Newbie here 👋',                       'FEMALE', '2026-05-25 10:00:00+07:00', '2026-05-29 09:30:00+07:00', 0, '2026-05-29 09:30:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(12, '0901000012', 'Phan Văn Minh',       'phanvanminh',  'https://i.pravatar.cc/150?u=minh',     '1991-10-08', 'Just joined! 🎉',                      'MALE',   '2026-05-26 15:20:00+07:00', '2026-05-29 10:00:00+07:00', 0, '2026-05-29 10:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(13, '0901000013', 'Lý Thị Ngọc',         'lythingoc',    'https://i.pravatar.cc/150?u=ngoc',     '2003-01-30', 'Mới tham gia 😊',                      'FEMALE', '2026-05-27 08:45:00+07:00', '2026-05-28 20:00:00+07:00', 0, '2026-05-28 20:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(14, '0901000014', 'Đặng Quốc Phong',     'dangquocphong','https://i.pravatar.cc/150?u=phong',    '1992-04-15', 'Hello World!',                         'MALE',   '2026-05-28 12:00:00+07:00', '2026-05-29 07:00:00+07:00', 0, '2026-05-29 07:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- Locked users
(15, '0901000015', 'Tạ Công Quân',        'tacongquan',   'https://i.pravatar.cc/150?u=quan',     '1988-07-04', 'Spam account',                         'MALE',   '2025-05-01 10:00:00+07:00', '2026-04-10 09:00:00+07:00', 0, '2026-04-10 09:00:00', 1, '2026-04-10 09:00:00+07:00', 'Vi phạm quy định cộng đồng - spam', '2026-07-10 09:00:00+07:00', 'admin', NULL, NULL, NULL),
(16, '0901000016', 'Mai Xuân Rạng',       'maixuanrang',  'https://i.pravatar.cc/150?u=rang',     '1995-12-20', NULL,                                   'MALE',   '2025-03-15 14:00:00+07:00', '2026-03-20 11:30:00+07:00', 0, '2026-03-20 11:30:00', 1, '2026-03-20 11:30:00+07:00', 'Nội dung không phù hợp', '2026-06-20 11:30:00+07:00', 'admin', NULL, NULL, NULL),

-- User with OTHER gender
(17, '0901000017', 'Hồ Sỹ Toàn',         'hosytoan',     'https://i.pravatar.cc/150?u=toan',     '1999-03-08', 'Freelancer 🎨',                        'OTHER',  '2026-02-14 16:00:00+07:00', '2026-05-29 08:30:00+07:00', 0, '2026-05-29 08:30:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- User requesting deletion
(18, '0901000018', 'Vũ Thị Uyên',         'vuthiuyen',    'https://i.pravatar.cc/150?u=uyen',     '2000-09-18', 'Tạm biệt mọi người',                  'FEMALE', '2025-04-20 08:00:00+07:00', '2026-05-20 15:00:00+07:00', 0, '2026-05-20 15:00:00', 0, NULL, NULL, NULL, NULL, '2026-05-20 15:00:00+07:00', '2026-06-04 15:00:00+07:00', NULL),

-- Users active today (for activeToday stat)
(19, '0901000019', 'Cao Hữu Vinh',        'caohuuvinh',   'https://i.pravatar.cc/150?u=vinh',     '1997-11-11', 'Gamer | Streamer 🎮',                  'MALE',   '2026-03-01 10:00:00+07:00', '2026-05-29 10:30:00+07:00', 0, '2026-05-29 10:30:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(20, '0901000020', 'Lâm Thị Xuân',        'lamthixuan',   'https://i.pravatar.cc/150?u=xuan',     '2001-12-25', 'Yêu âm nhạc 🎶',                      'FEMALE', '2026-04-01 12:00:00+07:00', '2026-05-29 11:00:00+07:00', 0, '2026-05-29 11:00:00', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- ============================================================
-- 2. COLORS
-- ============================================================
INSERT INTO colors (id, background, font, admin) VALUES
(1, '#FFFFFF', '#000000', NULL),
(2, '#1E1E2E', '#FFFFFF', NULL),
(3, '#E3F2FD', '#1565C0', NULL),
(4, '#FFF3E0', '#E65100', NULL),
(5, '#E8F5E9', '#2E7D32', NULL);

-- ============================================================
-- 3. PAGES (10 pages)
-- ============================================================
INSERT INTO pages (id, name, username, category, description, avatar_url, cover_url, phone, email, website, address, is_verified, status, created_by, created_at, updated_at) VALUES
(1, 'Cộng đồng Lập trình Việt Nam', 'dev_vietnam',     'Công nghệ',  'Chia sẻ kiến thức lập trình, thuật toán, và kinh nghiệm làm việc trong ngành IT.',                     'https://i.pravatar.cc/150?u=page1', 'https://picsum.photos/seed/page1/800/300', '0281234567', 'devvn@example.com',    'https://devvn.com',    'Quận 1, TP.HCM',    1, 'PUBLIC',  1, '2025-06-01 10:00:00+07:00', '2026-05-28 15:00:00+07:00'),
(2, 'Ẩm thực Sài Gòn',              'amthuc_saigon',   'Ẩm thực',    'Review đồ ăn ngon, quán mới tại Sài Gòn và các tỉnh lân cận.',                                        'https://i.pravatar.cc/150?u=page2', 'https://picsum.photos/seed/page2/800/300', NULL,         'food@example.com',     NULL,                   'TP.HCM',             0, 'PUBLIC',  3, '2025-07-15 08:00:00+07:00', '2026-05-27 12:00:00+07:00'),
(3, 'Du lịch Việt Nam',              'travel_vn',       'Du lịch',    'Khám phá vẻ đẹp Việt Nam qua mỗi chuyến đi. Tips du lịch, review homestay, khách sạn.',              'https://i.pravatar.cc/150?u=page3', 'https://picsum.photos/seed/page3/800/300', NULL,         NULL,                   'https://travelvn.com', NULL,                  1, 'PUBLIC',  6, '2025-08-20 14:30:00+07:00', '2026-05-29 08:00:00+07:00'),
(4, 'Âm nhạc Underground',           'underground_vn',  'Âm nhạc',    'Cộng đồng yêu nhạc indie, underground Việt Nam.',                                                     'https://i.pravatar.cc/150?u=page4', 'https://picsum.photos/seed/page4/800/300', NULL,         'music@example.com',    NULL,                   'Hà Nội',              0, 'PUBLIC',  20,'2025-10-01 16:00:00+07:00', '2026-05-25 20:00:00+07:00'),
(5, 'Thú cưng đáng yêu',             'pet_lovers_vn',   'Thú cưng',   'Chia sẻ ảnh, video thú cưng đáng yêu và kinh nghiệm nuôi thú cưng.',                                 'https://i.pravatar.cc/150?u=page5', 'https://picsum.photos/seed/page5/800/300', NULL,         NULL,                   NULL,                   NULL,                  0, 'PUBLIC',  9, '2025-11-15 09:00:00+07:00', '2026-05-28 10:00:00+07:00'),
(6, 'Gym & Fitness Vietnam',          'gym_fitness_vn',  'Sức khỏe',   'Chia sẻ kiến thức tập luyện, dinh dưỡng, và động lực sống khỏe.',                                    'https://i.pravatar.cc/150?u=page6', 'https://picsum.photos/seed/page6/800/300', NULL,         'fitness@example.com',  NULL,                   'Quận 7, TP.HCM',     0, 'PRIVATE', 4, '2026-01-10 07:00:00+07:00', '2026-05-29 06:00:00+07:00'),
(7, 'Sách hay nên đọc',              'sachhay_vn',      'Giáo dục',   'Review sách, chia sẻ kiến thức từ những cuốn sách hay nhất.',                                         'https://i.pravatar.cc/150?u=page7', 'https://picsum.photos/seed/page7/800/300', NULL,         NULL,                   NULL,                   NULL,                  0, 'PUBLIC',  10,'2026-02-01 11:00:00+07:00', '2026-05-26 14:00:00+07:00'),
(8, 'Gaming Việt Nam',                'gaming_vn',       'Giải trí',   'Tin tức game, esports, review game mới nhất.',                                                        'https://i.pravatar.cc/150?u=page8', 'https://picsum.photos/seed/page8/800/300', NULL,         'gaming@example.com',   NULL,                   NULL,                  1, 'PUBLIC',  19,'2026-03-15 15:00:00+07:00', '2026-05-29 09:00:00+07:00'),
(9, 'Trang bị khóa test',            'banned_page',     'Khác',       'Trang này đã bị khóa do vi phạm.',                                                                   'https://i.pravatar.cc/150?u=page9', NULL,                                       NULL,         NULL,                   NULL,                   NULL,                  0, 'BANNED',  15,'2025-05-10 10:00:00+07:00', '2026-04-10 09:00:00+07:00'),
(10,'Startup Việt Nam',               'startup_vn',      'Kinh doanh', 'Kết nối cộng đồng khởi nghiệp, chia sẻ kinh nghiệm xây dựng startup.',                               'https://i.pravatar.cc/150?u=page10','https://picsum.photos/seed/page10/800/300',NULL,         'startup@example.com',  'https://startupvn.com','Quận 3, TP.HCM',      0, 'PUBLIC',  2, '2026-04-20 10:00:00+07:00', '2026-05-29 07:00:00+07:00');

-- ============================================================
-- 4. PAGE MEMBERS
-- ============================================================
INSERT INTO page_members (id, page_id, user_id, role, status, joined_at) VALUES
-- Page 1 - Lập trình VN (admin: user 1, many members)
(1,  1, 1,  'ADMIN',     'ACTIVE',  '2025-06-01 10:00:00+07:00'),
(2,  1, 2,  'MODERATOR', 'ACTIVE',  '2025-06-05 11:00:00+07:00'),
(3,  1, 4,  'USER',      'ACTIVE',  '2025-06-10 14:00:00+07:00'),
(4,  1, 5,  'USER',      'ACTIVE',  '2025-07-01 09:00:00+07:00'),
(5,  1, 8,  'EDITOR',    'ACTIVE',  '2025-08-15 16:00:00+07:00'),
(6,  1, 10, 'ANALYST',   'ACTIVE',  '2026-01-30 10:00:00+07:00'),
(7,  1, 17, 'USER',      'ACTIVE',  '2026-03-01 12:00:00+07:00'),
(8,  1, 11, 'USER',      'PENDING', '2026-05-26 14:00:00+07:00'),
(9,  1, 14, 'USER',      'PENDING', '2026-05-28 16:00:00+07:00'),

-- Page 2 - Ẩm thực
(10, 2, 3,  'ADMIN',     'ACTIVE',  '2025-07-15 08:00:00+07:00'),
(11, 2, 7,  'MODERATOR', 'ACTIVE',  '2025-08-01 10:00:00+07:00'),
(12, 2, 9,  'USER',      'ACTIVE',  '2025-09-10 11:00:00+07:00'),
(13, 2, 5,  'USER',      'ACTIVE',  '2025-10-20 15:00:00+07:00'),

-- Page 3 - Du lịch VN
(14, 3, 6,  'ADMIN',     'ACTIVE',  '2025-08-20 14:30:00+07:00'),
(15, 3, 2,  'USER',      'ACTIVE',  '2025-09-01 08:00:00+07:00'),
(16, 3, 3,  'USER',      'ACTIVE',  '2025-09-15 10:00:00+07:00'),
(17, 3, 7,  'EDITOR',    'ACTIVE',  '2025-10-01 12:00:00+07:00'),
(18, 3, 19, 'USER',      'ACTIVE',  '2026-04-01 14:00:00+07:00'),

-- Page 4 - Âm nhạc
(19, 4, 20, 'ADMIN',     'ACTIVE',  '2025-10-01 16:00:00+07:00'),
(20, 4, 17, 'USER',      'ACTIVE',  '2025-11-01 10:00:00+07:00'),

-- Page 5 - Thú cưng
(21, 5, 9,  'ADMIN',     'ACTIVE',  '2025-11-15 09:00:00+07:00'),
(22, 5, 5,  'USER',      'ACTIVE',  '2025-12-01 08:00:00+07:00'),
(23, 5, 7,  'USER',      'ACTIVE',  '2026-01-10 11:00:00+07:00'),
(24, 5, 13, 'USER',      'PENDING', '2026-05-27 15:00:00+07:00'),

-- Page 6 - Gym (private)
(25, 6, 4,  'ADMIN',     'ACTIVE',  '2026-01-10 07:00:00+07:00'),
(26, 6, 2,  'USER',      'ACTIVE',  '2026-01-15 08:00:00+07:00'),
(27, 6, 19, 'USER',      'ACTIVE',  '2026-03-10 09:00:00+07:00'),
(28, 6, 12, 'USER',      'PENDING', '2026-05-26 17:00:00+07:00'),

-- Page 8 - Gaming
(29, 8, 19, 'ADMIN',     'ACTIVE',  '2026-03-15 15:00:00+07:00'),
(30, 8, 8,  'MODERATOR', 'ACTIVE',  '2026-03-20 10:00:00+07:00'),
(31, 8, 4,  'USER',      'ACTIVE',  '2026-04-01 12:00:00+07:00'),
(32, 8, 10, 'USER',      'ACTIVE',  '2026-04-15 14:00:00+07:00'),

-- Page 10 - Startup VN
(33, 10, 2,  'ADMIN',    'ACTIVE',  '2026-04-20 10:00:00+07:00'),
(34, 10, 4,  'EDITOR',   'ACTIVE',  '2026-04-25 11:00:00+07:00'),
(35, 10, 10, 'USER',     'ACTIVE',  '2026-05-01 09:00:00+07:00');

-- ============================================================
-- 5. PAGE FOLLOWS
-- ============================================================
INSERT INTO page_follows (id, page_id, user_id, followed_at) VALUES
(1,  1, 2,  '2025-06-05 11:00:00+07:00'),
(2,  1, 3,  '2025-06-20 09:00:00+07:00'),
(3,  1, 4,  '2025-06-10 14:00:00+07:00'),
(4,  1, 5,  '2025-07-01 09:00:00+07:00'),
(5,  1, 6,  '2025-08-01 10:00:00+07:00'),
(6,  1, 7,  '2025-09-01 11:00:00+07:00'),
(7,  1, 8,  '2025-08-15 16:00:00+07:00'),
(8,  1, 9,  '2026-01-15 08:00:00+07:00'),
(9,  1, 10, '2026-01-30 10:00:00+07:00'),
(10, 1, 11, '2026-05-26 14:00:00+07:00'),
(11, 2, 5,  '2025-10-20 15:00:00+07:00'),
(12, 2, 7,  '2025-08-01 10:00:00+07:00'),
(13, 2, 9,  '2025-09-10 11:00:00+07:00'),
(14, 2, 20, '2026-04-05 12:00:00+07:00'),
(15, 3, 2,  '2025-09-01 08:00:00+07:00'),
(16, 3, 3,  '2025-09-15 10:00:00+07:00'),
(17, 3, 5,  '2025-10-10 14:00:00+07:00'),
(18, 3, 7,  '2025-10-01 12:00:00+07:00'),
(19, 3, 19, '2026-04-01 14:00:00+07:00'),
(20, 3, 20, '2026-04-10 09:00:00+07:00'),
(21, 4, 17, '2025-11-01 10:00:00+07:00'),
(22, 4, 5,  '2025-12-01 14:00:00+07:00'),
(23, 5, 5,  '2025-12-01 08:00:00+07:00'),
(24, 5, 7,  '2026-01-10 11:00:00+07:00'),
(25, 5, 3,  '2026-02-01 09:00:00+07:00'),
(26, 6, 2,  '2026-01-15 08:00:00+07:00'),
(27, 6, 19, '2026-03-10 09:00:00+07:00'),
(28, 8, 4,  '2026-04-01 12:00:00+07:00'),
(29, 8, 8,  '2026-03-20 10:00:00+07:00'),
(30, 8, 10, '2026-04-15 14:00:00+07:00'),
(31, 10, 4, '2026-04-25 11:00:00+07:00'),
(32, 10, 10,'2026-05-01 09:00:00+07:00'),
(33, 10, 7, '2026-05-10 08:00:00+07:00');

-- ============================================================
-- 6. PAGE LIKES
-- ============================================================
INSERT INTO page_likes (id, page_id, user_id, liked_at) VALUES
(1,  1, 2,  '2025-06-05 11:05:00+07:00'),
(2,  1, 3,  '2025-06-20 09:05:00+07:00'),
(3,  1, 4,  '2025-06-10 14:05:00+07:00'),
(4,  1, 5,  '2025-07-01 09:05:00+07:00'),
(5,  1, 8,  '2025-08-15 16:05:00+07:00'),
(6,  1, 10, '2026-01-30 10:05:00+07:00'),
(7,  2, 5,  '2025-10-20 15:05:00+07:00'),
(8,  2, 9,  '2025-09-10 11:05:00+07:00'),
(9,  2, 7,  '2025-08-01 10:05:00+07:00'),
(10, 3, 2,  '2025-09-01 08:05:00+07:00'),
(11, 3, 7,  '2025-10-01 12:05:00+07:00'),
(12, 3, 19, '2026-04-01 14:05:00+07:00'),
(13, 3, 20, '2026-04-10 09:05:00+07:00'),
(14, 4, 17, '2025-11-01 10:05:00+07:00'),
(15, 5, 5,  '2025-12-01 08:05:00+07:00'),
(16, 5, 7,  '2026-01-10 11:05:00+07:00'),
(17, 6, 19, '2026-03-10 09:05:00+07:00'),
(18, 8, 4,  '2026-04-01 12:05:00+07:00'),
(19, 8, 10, '2026-04-15 14:05:00+07:00'),
(20, 10, 4, '2026-04-25 11:05:00+07:00');

-- ============================================================
-- 7. FRIENDS (various statuses)
-- ============================================================
INSERT INTO friends (id, user_id, friend_id, status, friend_at) VALUES
-- Accepted friendships
(1,  2,  3,  'ACCEPTED', '2025-07-25 10:00:00'),
(2,  3,  2,  'ACCEPTED', '2025-07-25 10:00:00'),
(3,  2,  4,  'ACCEPTED', '2025-08-15 14:00:00'),
(4,  4,  2,  'ACCEPTED', '2025-08-15 14:00:00'),
(5,  2,  5,  'ACCEPTED', '2025-09-10 09:00:00'),
(6,  5,  2,  'ACCEPTED', '2025-09-10 09:00:00'),
(7,  3,  5,  'ACCEPTED', '2025-10-01 11:00:00'),
(8,  5,  3,  'ACCEPTED', '2025-10-01 11:00:00'),
(9,  4,  8,  'ACCEPTED', '2025-12-25 16:00:00'),
(10, 8,  4,  'ACCEPTED', '2025-12-25 16:00:00'),
(11, 6,  7,  'ACCEPTED', '2025-11-10 13:00:00'),
(12, 7,  6,  'ACCEPTED', '2025-11-10 13:00:00'),
(13, 9,  10, 'ACCEPTED', '2026-02-01 10:00:00'),
(14, 10, 9,  'ACCEPTED', '2026-02-01 10:00:00'),
(15, 2,  10, 'ACCEPTED', '2026-02-15 12:00:00'),
(16, 10, 2,  'ACCEPTED', '2026-02-15 12:00:00'),
(17, 3,  7,  'ACCEPTED', '2025-11-20 15:00:00'),
(18, 7,  3,  'ACCEPTED', '2025-11-20 15:00:00'),
(19, 4,  6,  'ACCEPTED', '2026-01-05 08:00:00'),
(20, 6,  4,  'ACCEPTED', '2026-01-05 08:00:00'),
(21, 5,  9,  'ACCEPTED', '2026-01-20 10:00:00'),
(22, 9,  5,  'ACCEPTED', '2026-01-20 10:00:00'),
(23, 19, 20, 'ACCEPTED', '2026-04-10 14:00:00'),
(24, 20, 19, 'ACCEPTED', '2026-04-10 14:00:00'),
(25, 2,  19, 'ACCEPTED', '2026-04-15 11:00:00'),
(26, 19, 2,  'ACCEPTED', '2026-04-15 11:00:00'),

-- Pending requests
(27, 11, 2,  'PENDING',  '2026-05-26 15:00:00'),
(28, 12, 3,  'PENDING',  '2026-05-27 09:00:00'),
(29, 13, 5,  'PENDING',  '2026-05-27 16:00:00'),
(30, 14, 4,  'PENDING',  '2026-05-28 13:00:00'),

-- Blocked
(31, 2,  15, 'BLOCKED',  '2026-04-10 09:30:00'),
(32, 3,  16, 'BLOCKED',  '2026-03-20 12:00:00');

-- ============================================================
-- 8. FOLLOWS (user follows)
-- ============================================================
INSERT INTO follows (id, follower_id, following_id, followed_at, notifications_enabled) VALUES
(1,  2,  1,  '2025-06-16 10:00:00', 1),
(2,  3,  2,  '2025-07-25 11:00:00', 1),
(3,  5,  4,  '2025-09-12 08:00:00', 0),
(4,  7,  6,  '2025-11-10 14:00:00', 1),
(5,  9,  3,  '2026-01-12 09:00:00', 0),
(6,  10, 2,  '2026-02-15 13:00:00', 1),
(7,  11, 2,  '2026-05-26 15:30:00', 1),
(8,  12, 4,  '2026-05-27 10:00:00', 0),
(9,  20, 3,  '2026-04-05 11:00:00', 1),
(10, 19, 8,  '2026-04-02 15:00:00', 0),
(11, 2,  6,  '2026-01-06 09:00:00', 1),
(12, 4,  10, '2026-03-01 12:00:00', 0);

-- ============================================================
-- 9. USER SETTINGS
-- ============================================================
INSERT INTO user_settings (user_id, privacy_profile, allow_message_from_strangers) VALUES
(1,  'PUBLIC',   1),
(2,  'PUBLIC',   1),
(3,  'FRIENDS',  1),
(4,  'PUBLIC',   0),
(5,  'PUBLIC',   1),
(6,  'PUBLIC',   1),
(7,  'FRIENDS',  0),
(8,  'PUBLIC',   1),
(9,  'ONLY_ME',  0),
(10, 'PUBLIC',   1),
(11, 'PUBLIC',   1),
(12, 'PUBLIC',   1),
(17, 'FRIENDS',  1),
(19, 'PUBLIC',   1),
(20, 'PUBLIC',   1);

-- ============================================================
-- 10. NOTIFICATION SETTINGS
-- ============================================================
INSERT INTO notification_settings (user_id, message_sound_enabled, story_updates_enabled) VALUES
(1,  1, 1),
(2,  1, 1),
(3,  1, 0),
(4,  0, 1),
(5,  1, 1),
(6,  1, 1),
(7,  1, 1),
(8,  0, 0),
(9,  1, 1),
(10, 1, 1);

-- ============================================================
-- 11. DEVICES
-- ============================================================
INSERT INTO devices (id, device_type, name_device, ip_address, create_at, user_id) VALUES
(1,  'MOBILE',  'iPhone 15 Pro',         '192.168.1.101', '2026-05-29 08:00:00+07:00', 1),
(2,  'WEB',     'Chrome on Windows',     '192.168.1.102', '2026-05-29 09:00:00+07:00', 1),
(3,  'MOBILE',  'Samsung Galaxy S24',    '10.0.0.50',     '2026-05-28 14:20:00+07:00', 2),
(4,  'MOBILE',  'iPhone 14',             '10.0.0.51',     '2026-05-29 09:00:00+07:00', 3),
(5,  'WEB',     'Firefox on macOS',      '172.16.0.10',   '2026-05-27 22:10:00+07:00', 4),
(6,  'MOBILE',  'Xiaomi 14',             '10.0.0.52',     '2026-05-29 07:30:00+07:00', 5),
(7,  'MOBILE',  'iPhone 16',             '10.0.0.53',     '2026-05-28 18:45:00+07:00', 6),
(8,  'WEB',     'Edge on Windows',       '192.168.1.103', '2026-05-29 06:15:00+07:00', 7);

-- ============================================================
-- 12. DEVICE SETTINGS
-- ============================================================
INSERT INTO device_settings (id, user_id, device_name, device_type, theme_mode, push_enabled, likes_enabled, comments_enabled, follows_enabled, messages_enabled, page_updates_enabled) VALUES
(1, 1,  'iPhone 15 Pro',      'MOBILE', 'system', 1, 1, 1, 1, 1, 1),
(2, 1,  'Chrome on Windows',  'WEB',    'light',  0, 1, 1, 1, 1, 1),
(3, 2,  'Samsung Galaxy S24', 'MOBILE', 'dark',   1, 1, 1, 1, 1, 0),
(4, 3,  'iPhone 14',          'MOBILE', 'light',  1, 1, 0, 1, 1, 1),
(5, 4,  'Firefox on macOS',   'WEB',    'dark',   0, 1, 1, 0, 1, 0);

-- ============================================================
-- 13. BLOCKED USERS
-- ============================================================
INSERT INTO blocked_users (id, blocker_id, blocker_page_id, blocked_id) VALUES
(1, 2,    NULL, 15),
(2, 3,    NULL, 16),
(3, NULL, 1,    15),
(4, 9,    NULL, 16);

-- ============================================================
-- 14. CONVERSATIONS (5 conversations)
-- ============================================================
INSERT INTO conversations (id, type, direct_key, name, image_url, updated_at, last_message_id, last_message_content, last_message_at, last_message_type, last_sender_id, last_sender_name, is_message_restricted, is_join_approval_required, invite_token, pinned_messages) VALUES
-- Direct messages
(1, 'DIRECT', '2_3',  NULL,                       NULL,                                      '2026-05-29 09:30:00+07:00', NULL, 'Chào bạn, dạo này sao rồi?',        '2026-05-29 09:30:00+07:00', 'TEXT',  3, 'Trần Thị Bình',     0, 0, NULL, NULL),
(2, 'DIRECT', '2_4',  NULL,                       NULL,                                      '2026-05-28 20:15:00+07:00', NULL, 'Code review xong rồi nhé!',          '2026-05-28 20:15:00+07:00', 'TEXT',  4, 'Lê Hoàng Cường',    0, 0, NULL, NULL),
(3, 'DIRECT', '5_9',  NULL,                       NULL,                                      '2026-05-29 07:45:00+07:00', NULL, 'Tối nay đi ăn không?',               '2026-05-29 07:45:00+07:00', 'TEXT',  5, 'Phạm Thị Duyên',    0, 0, NULL, NULL),

-- Group chats
(4, 'GROUP',  NULL,   'Nhóm Lập Trình Viên',     'https://picsum.photos/seed/group1/100/100','2026-05-29 10:00:00+07:00', NULL, 'Ai rảnh review PR #42 không?',       '2026-05-29 10:00:00+07:00', 'TEXT',  8, 'Đỗ Quang Huy',      0, 0, 'inv_abc123', NULL),
(5, 'GROUP',  NULL,   'Hội Du Lịch Cuối Tuần',   'https://picsum.photos/seed/group2/100/100','2026-05-28 22:00:00+07:00', NULL, 'Đà Lạt hay Vũng Tàu mọi người?',   '2026-05-28 22:00:00+07:00', 'TEXT',  6, 'Hoàng Minh Đức',    0, 1, 'inv_xyz789', NULL);

-- ============================================================
-- 15. CONVERSATION MEMBERS
-- ============================================================
INSERT INTO conversation_members (id, conversation_id, user_id, is_muted, last_read_id, nickname, role, status, joined_at, left_at, blocked_at, blocked_by, last_read_message_id, unread_count, frozen_last_message, personal_last_message, hidden_global_message_id, cleared_at, is_hidden, color_id) VALUES
-- Conversation 1 (Direct: user 2 & 3)
(1,  1, 2, 0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-07-25 10:00:00+07:00', NULL, NULL, NULL, NULL, 1,  NULL, NULL, NULL, NULL, 0, NULL),
(2,  1, 3, 0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-07-25 10:00:00+07:00', NULL, NULL, NULL, NULL, 0,  NULL, NULL, NULL, NULL, 0, NULL),

-- Conversation 2 (Direct: user 2 & 4)
(3,  2, 2, 0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-08-15 14:00:00+07:00', NULL, NULL, NULL, NULL, 0,  NULL, NULL, NULL, NULL, 0, NULL),
(4,  2, 4, 0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-08-15 14:00:00+07:00', NULL, NULL, NULL, NULL, 1,  NULL, NULL, NULL, NULL, 0, NULL),

-- Conversation 3 (Direct: user 5 & 9)
(5,  3, 5, 0, NULL, NULL,          'MEMBER', 'ACTIVE', '2026-01-20 10:00:00+07:00', NULL, NULL, NULL, NULL, 0,  NULL, NULL, NULL, NULL, 0, NULL),
(6,  3, 9, 1, NULL, NULL,          'MEMBER', 'ACTIVE', '2026-01-20 10:00:00+07:00', NULL, NULL, NULL, NULL, 2,  NULL, NULL, NULL, NULL, 0, NULL),

-- Conversation 4 (Group: Lập Trình Viên)
(7,  4, 2,  0, NULL, 'Anh An',     'OWNER',  'ACTIVE', '2025-08-20 10:00:00+07:00', NULL, NULL, NULL, NULL, 3,  NULL, NULL, NULL, NULL, 0, 3),
(8,  4, 4,  0, NULL, 'Cường Dev',  'DEPUTY', 'ACTIVE', '2025-08-20 10:00:00+07:00', NULL, NULL, NULL, NULL, 1,  NULL, NULL, NULL, NULL, 0, NULL),
(9,  4, 8,  0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-12-26 09:00:00+07:00', NULL, NULL, NULL, NULL, 0,  NULL, NULL, NULL, NULL, 0, NULL),
(10, 4, 10, 0, NULL, 'Khoa AI',    'MEMBER', 'ACTIVE', '2026-02-01 11:00:00+07:00', NULL, NULL, NULL, NULL, 5,  NULL, NULL, NULL, NULL, 0, NULL),
(11, 4, 5,  0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-09-15 08:00:00+07:00', NULL, NULL, NULL, NULL, 2,  NULL, NULL, NULL, NULL, 0, NULL),

-- Conversation 5 (Group: Du Lịch)
(12, 5, 6,  0, NULL, NULL,          'OWNER',  'ACTIVE', '2025-11-15 10:00:00+07:00', NULL, NULL, NULL, NULL, 0,  NULL, NULL, NULL, NULL, 0, NULL),
(13, 5, 3,  0, NULL, 'Bình Cute',  'DEPUTY', 'ACTIVE', '2025-11-15 10:00:00+07:00', NULL, NULL, NULL, NULL, 1,  NULL, NULL, NULL, NULL, 0, 4),
(14, 5, 7,  0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-11-16 08:00:00+07:00', NULL, NULL, NULL, NULL, 2,  NULL, NULL, NULL, NULL, 0, NULL),
(15, 5, 19, 0, NULL, NULL,          'MEMBER', 'ACTIVE', '2026-04-05 14:00:00+07:00', NULL, NULL, NULL, NULL, 4,  NULL, NULL, NULL, NULL, 0, NULL),
(16, 5, 2,  0, NULL, NULL,          'MEMBER', 'ACTIVE', '2025-11-20 09:00:00+07:00', NULL, NULL, NULL, NULL, 3,  NULL, NULL, NULL, NULL, 0, NULL);

-- ============================================================
-- 16. PAGE POSTS (linking MongoDB post IDs to pages)
-- ============================================================
INSERT INTO page_posts (id, post_id, page_id, status, approved_by, approved_at, created_at, updated_at) VALUES
(1,  '683700000000000000000001', 1, 'APPROVED', 1, '2026-05-20 11:00:00+07:00', '2026-05-20 10:00:00+07:00', '2026-05-20 11:00:00+07:00'),
(2,  '683700000000000000000002', 1, 'APPROVED', 2, '2026-05-22 09:00:00+07:00', '2026-05-22 08:00:00+07:00', '2026-05-22 09:00:00+07:00'),
(3,  '683700000000000000000003', 2, 'APPROVED', 3, '2026-05-24 15:00:00+07:00', '2026-05-24 14:00:00+07:00', '2026-05-24 15:00:00+07:00'),
(4,  '683700000000000000000004', 3, 'APPROVED', 6, '2026-05-25 10:00:00+07:00', '2026-05-25 09:00:00+07:00', '2026-05-25 10:00:00+07:00'),
(5,  '683700000000000000000010', 1, 'PENDING',  NULL, NULL, '2026-05-28 16:00:00+07:00', '2026-05-28 16:00:00+07:00'),
(6,  '683700000000000000000011', 2, 'PENDING',  NULL, NULL, '2026-05-29 07:00:00+07:00', '2026-05-29 07:00:00+07:00'),
(7,  '683700000000000000000012', 3, 'REJECTED', 6,  '2026-05-27 12:00:00+07:00', '2026-05-27 11:00:00+07:00', '2026-05-27 12:00:00+07:00');

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- SELECT 'users' AS tbl, COUNT(*) AS cnt FROM users
-- UNION ALL SELECT 'pages', COUNT(*) FROM pages
-- UNION ALL SELECT 'page_members', COUNT(*) FROM page_members
-- UNION ALL SELECT 'page_follows', COUNT(*) FROM page_follows
-- UNION ALL SELECT 'page_likes', COUNT(*) FROM page_likes
-- UNION ALL SELECT 'page_posts', COUNT(*) FROM page_posts
-- UNION ALL SELECT 'friends', COUNT(*) FROM friends
-- UNION ALL SELECT 'follows', COUNT(*) FROM follows
-- UNION ALL SELECT 'user_settings', COUNT(*) FROM user_settings
-- UNION ALL SELECT 'notification_settings', COUNT(*) FROM notification_settings
-- UNION ALL SELECT 'devices', COUNT(*) FROM devices
-- UNION ALL SELECT 'device_settings', COUNT(*) FROM device_settings
-- UNION ALL SELECT 'blocked_users', COUNT(*) FROM blocked_users
-- UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
-- UNION ALL SELECT 'conversation_members', COUNT(*) FROM conversation_members
-- UNION ALL SELECT 'colors', COUNT(*) FROM colors;
