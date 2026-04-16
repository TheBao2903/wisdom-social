/*
 * @ (#) DataSeeder.java    1.0
 * Copyright (c)  IUH. All rights reserved.
 */
package iuh.fit.edu.backend.util;

import iuh.fit.edu.backend.constant.ConversationType;
import iuh.fit.edu.backend.constant.Gender;
import iuh.fit.edu.backend.domain.entity.mysql.Color;
import iuh.fit.edu.backend.domain.entity.mysql.Conversation;
import iuh.fit.edu.backend.domain.entity.mysql.ConversationMember;
import iuh.fit.edu.backend.domain.entity.mysql.User;
import iuh.fit.edu.backend.repository.mysql.ColorRepository;
import iuh.fit.edu.backend.repository.mysql.ConversationRepository;
import iuh.fit.edu.backend.repository.mysql.ConversationMemberRepository;
import iuh.fit.edu.backend.repository.mysql.UserRepository;
import iuh.fit.edu.backend.service.chat.MessageCacheService;
import iuh.fit.edu.backend.service.chat.impl.MessageCacheServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/*
 * @description: Data seeder to populate database with sample data
 * @author: Huu Thai
 * @date: 22/01/2026
 * @version: 1.0
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ColorRepository colorRepository;
    private final MessageCacheService messageCacheService;

    @Override
    public void run(String... args) throws Exception {
        // Kiểm tra nếu đã có dữ liệu thì không seed nữa
        if (userRepository.count() > 0) {
            log.info("Database already contains data. Skipping seeding.");
            return;
        }

        log.info("Starting data seeding...");

        // Tạo colors
        List<Color> colors = createColors();

        // Tạo users
        List<User> users = createUsers();

        // Tạo conversations (group chat và direct)
        createConversations(users, colors);

        log.info("Data seeding completed successfully!");
    }

    private List<Color> createColors() {
        List<Color> colors = new ArrayList<>();

        Color color1 = new Color();
        color1.setBackground("#E3F2FD");
        color1.setFont("#1976D2");
        color1.setAdmin("#0D47A1");
        colors.add(color1);

        Color color2 = new Color();
        color2.setBackground("#F3E5F5");
        color2.setFont("#7B1FA2");
        color2.setAdmin("#4A148C");
        colors.add(color2);

        Color color3 = new Color();
        color3.setBackground("#E8F5E9");
        color3.setFont("#388E3C");
        color3.setAdmin("#1B5E20");
        colors.add(color3);

        Color color4 = new Color();
        color4.setBackground("#FFF3E0");
        color4.setFont("#F57C00");
        color4.setAdmin("#E65100");
        colors.add(color4);

        colorRepository.saveAll(colors);
        log.info("Created {} colors", colors.size());
        return colors;
    }

    private List<User> createUsers() {
        List<User> users = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now();

        User user1 = new User();
        user1.setPhone("0901234567");
        user1.setName("Nguyễn Văn An");
        user1.setUsername("nguyen_van_an");
        user1.setAvatarUrl("https://i.pravatar.cc/150?img=1");
        user1.setBio("Yêu thích công nghệ và lập trình");
        user1.setGender(Gender.MALE);
        user1.setCreatedAt(now);
        user1.setUpdatedAt(now);
        user1.setConfirmUseAI(true);
        users.add(user1);

        User user2 = new User();
        user2.setPhone("0912345678");
        user2.setName("Trần Thị Bình");
        user2.setUsername("tran_thi_binh");
        user2.setAvatarUrl("https://i.pravatar.cc/150?img=5");
        user2.setBio("Đam mê thiết kế và nghệ thuật");
        user2.setGender(Gender.FEMALE);
        user2.setCreatedAt(now);
        user2.setUpdatedAt(now);
        user2.setConfirmUseAI(false);
        users.add(user2);

        User user3 = new User();
        user3.setPhone("0923456789");
        user3.setName("Lê Minh Châu");
        user3.setUsername("le_minh_chau");
        user3.setAvatarUrl("https://i.pravatar.cc/150?img=8");
        user3.setBio("Sinh viên IT, thích đọc sách");
        user3.setGender(Gender.MALE);
        user3.setCreatedAt(now);
        user3.setUpdatedAt(now);
        user3.setConfirmUseAI(true);
        users.add(user3);

        User user4 = new User();
        user4.setPhone("0934567890");
        user4.setName("Phạm Thị Dung");
        user4.setUsername("pham_thi_dung");
        user4.setAvatarUrl("https://i.pravatar.cc/150?img=9");
        user4.setBio("Yêu thích du lịch và nhiếp ảnh");
        user4.setGender(Gender.FEMALE);
        user4.setCreatedAt(now);
        user4.setUpdatedAt(now);
        user4.setConfirmUseAI(true);
        users.add(user4);

        userRepository.saveAll(users);
        log.info("Created {} users", users.size());
        return users;
    }

    private void createConversations(List<User> users, List<Color> colors) {
        Instant now = Instant.now();

        // 1. Tạo Group Chat (Nhóm học tập)
        Conversation groupChat1 = new Conversation();
        groupChat1.setType(ConversationType.GROUP);
        groupChat1.setName("Nhóm Học Tập IT");
        groupChat1.setImageUrl("https://i.pravatar.cc/200?img=20");
        groupChat1.setUpdatedAt(now);
        conversationRepository.save(groupChat1);

        // Thêm các thành viên vào group chat (tất cả 4 user)
        ConversationMember cu1 = new ConversationMember();
        cu1.setConversation(groupChat1);
        cu1.setUser(users.get(0)); // Nguyễn Văn An là admin
        cu1.setAdmin(true);
        cu1.setMuted(false);
        cu1.setLastReadId(0L);
        cu1.setNickname("An Leader");
        cu1.setColor(colors.get(0));
        conversationMemberRepository.save(cu1);

        ConversationMember cu2 = new ConversationMember();
        cu2.setConversation(groupChat1);
        cu2.setUser(users.get(1)); // Trần Thị Bình
        cu2.setAdmin(false);
        cu2.setMuted(false);
        cu2.setLastReadId(0L);
        cu2.setNickname("Bình Designer");
        cu2.setColor(colors.get(1));
        conversationMemberRepository.save(cu2);

        ConversationMember cu3 = new ConversationMember();
        cu3.setConversation(groupChat1);
        cu3.setUser(users.get(2)); // Lê Minh Châu
        cu3.setAdmin(false);
        cu3.setMuted(false);
        cu3.setLastReadId(0L);
        cu3.setNickname("Châu Developer");
        cu3.setColor(colors.get(2));
        conversationMemberRepository.save(cu3);

        ConversationMember cu4 = new ConversationMember();
        cu4.setConversation(groupChat1);
        cu4.setUser(users.get(3)); // Phạm Thị Dung
        cu4.setAdmin(false);
        cu4.setMuted(true); // User này tắt thông báo
        cu4.setLastReadId(0L);
        cu4.setNickname("Dung Photographer");
        cu4.setColor(colors.get(3));
        conversationMemberRepository.save(cu4);

        log.info("Created group chat: {} with {} members", groupChat1.getName(), 4);

        // 2. Tạo Group Chat thứ 2 (Nhóm dự án)
        Conversation groupChat2 = new Conversation();
        groupChat2.setType(ConversationType.GROUP);
        groupChat2.setName("Dự Án Wisdom Chat");
        groupChat2.setImageUrl("https://i.pravatar.cc/200?img=21");
        groupChat2.setUpdatedAt(now);
        conversationRepository.save(groupChat2);

        // Chỉ thêm 3 user vào group này (user1, user2, user3)
        ConversationMember cu5 = new ConversationMember();
        cu5.setConversation(groupChat2);
        cu5.setUser(users.get(0));
        cu5.setAdmin(true);
        cu5.setMuted(false);
        cu5.setLastReadId(0L);
        cu5.setNickname("PM An");
        cu5.setColor(colors.get(0));
        conversationMemberRepository.save(cu5);

        ConversationMember cu6 = new ConversationMember();
        cu6.setConversation(groupChat2);
        cu6.setUser(users.get(1));
        cu6.setAdmin(true); // Co-admin
        cu6.setMuted(false);
        cu6.setLastReadId(0L);
        cu6.setNickname("Designer Bình");
        cu6.setColor(colors.get(1));
        conversationMemberRepository.save(cu6);

        ConversationMember cu7 = new ConversationMember();
        cu7.setConversation(groupChat2);
        cu7.setUser(users.get(2));
        cu7.setAdmin(false);
        cu7.setMuted(false);
        cu7.setLastReadId(0L);
        cu7.setNickname("Dev Châu");
        cu7.setColor(colors.get(2));
        conversationMemberRepository.save(cu7);

        log.info("Created group chat: {} with {} members", groupChat2.getName(), 3);

        // 3. Tạo Direct Chat (User1 và User2)
        Conversation directChat1 = new Conversation();
        directChat1.setType(ConversationType.DIRECT);
        directChat1.setName(null); // Direct chat không có tên
        directChat1.setImageUrl(null); // Sẽ dùng avatar của user
        directChat1.setUpdatedAt(now);
        conversationRepository.save(directChat1);

        ConversationMember cu8 = new ConversationMember();
        cu8.setConversation(directChat1);
        cu8.setUser(users.getFirst()); // Nguyễn Văn An
        cu8.setAdmin(false);
        cu8.setMuted(false);
        cu8.setLastReadId(0L);
        cu8.setNickname(users.getFirst().getName());
        cu8.setColor(colors.getFirst());
        conversationMemberRepository.save(cu8);

        ConversationMember cu9 = new ConversationMember();
        cu9.setConversation(directChat1);
        cu9.setUser(users.get(1)); // Trần Thị Bình
        cu9.setAdmin(false);
        cu9.setMuted(false);
        cu9.setLastReadId(0L);
        cu9.setNickname(users.get(1).getName());
        cu9.setColor(colors.get(1));
        conversationMemberRepository.save(cu9);

        log.info("Created direct chat between {} and {}", users.get(0).getName(), users.get(1).getName());

        // 4. Tạo Direct Chat (User2 và User3)
        Conversation directChat2 = new Conversation();
        directChat2.setType(ConversationType.DIRECT);
        directChat2.setName(null);
        directChat2.setImageUrl(null);
        directChat2.setUpdatedAt(now);
        conversationRepository.save(directChat2);

        ConversationMember cu10 = new ConversationMember();
        cu10.setConversation(directChat2);
        cu10.setUser(users.get(1)); // Trần Thị Bình
        cu10.setAdmin(false);
        cu10.setMuted(false);
        cu10.setLastReadId(0L);
        cu10.setNickname(users.get(1).getName());
        cu10.setColor(colors.get(1));
        conversationMemberRepository.save(cu10);

        ConversationMember cu11 = new ConversationMember();
        cu11.setConversation(directChat2);
        cu11.setUser(users.get(2)); // Lê Minh Châu
        cu11.setAdmin(false);
        cu11.setMuted(false);
        cu11.setLastReadId(0L);
        cu11.setNickname(users.get(2).getName());
        cu11.setColor(colors.get(2));
        conversationMemberRepository.save(cu11);

        log.info("Created direct chat between {} and {}", users.get(1).getName(), users.get(2).getName());

        // 5. Tạo Direct Chat (User3 và User4)
        Conversation directChat3 = new Conversation();
        directChat3.setType(ConversationType.DIRECT);
        directChat3.setName(null);
        directChat3.setImageUrl(null);
        directChat3.setUpdatedAt(now);
        conversationRepository.save(directChat3);

        ConversationMember cu12 = new ConversationMember();
        cu12.setConversation(directChat3);
        cu12.setUser(users.get(2)); // Lê Minh Châu
        cu12.setAdmin(false);
        cu12.setMuted(false);
        cu12.setLastReadId(0L);
        cu12.setNickname(users.get(2).getName());
        cu12.setColor(colors.get(2));
        conversationMemberRepository.save(cu12);

        ConversationMember cu13 = new ConversationMember();
        cu13.setConversation(directChat3);
        cu13.setUser(users.get(3)); // Phạm Thị Dung
        cu13.setAdmin(false);
        cu13.setMuted(false);
        cu13.setLastReadId(0L);
        cu13.setNickname(users.get(3).getName());
        cu13.setColor(colors.get(3));
        conversationMemberRepository.save(cu13);

        log.info("Created direct chat between {} and {}", users.get(2).getName(), users.get(3).getName());

        log.info("Created total {} conversations (2 group chats, 3 direct chats)", 5);
    }
}

