# Wisdom Social

> A full-stack social networking platform with web and mobile clients, real-time messaging, QR authentication, media sharing, pages, stories, and AI-assisted chat workflows.

![Java](https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.6-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111111)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

---

## 🚀 Introduction

Wisdom Social is a production-style social media application built as a monorepo with three main surfaces:

- **Backend API** powered by Spring Boot, Spring Security, MariaDB, MongoDB, Redis, WebSocket/STOMP, AWS Cognito, S3-compatible storage, and OpenRouter-based AI services.
- **Web client** built with React, Vite, TypeScript, Tailwind CSS, Ant Design, and STOMP/SockJS for real-time communication.
- **Mobile client** built with Expo Router and React Native, including secure token storage, QR login support, camera access, and realtime chat synchronization.

The project focuses on practical social networking workflows: account registration, OTP confirmation, login, QR login, feeds, posts, stories, comments, reactions, saved posts, friend requests, pages, profile management, direct/group messaging, pinned messages, voice/video call signaling, and AI-powered conversation summaries/reply suggestions.

## ✨ Features

- 🔐 **Authentication & session management**
  - AWS Cognito-backed registration, login, confirmation, password reset, token refresh, and logout.
  - Cookie/token-based authentication for web and mobile clients.
  - QR login flow for pairing mobile confirmation with web sessions.

- 📝 **Social feed**
  - Create, edit, delete, and view posts.
  - Upload media through presigned URL workflows.
  - Comments, nested replies, reactions, saved posts, tagged posts, and user-specific profile feeds.

- 📸 **Stories & profile experience**
  - Story creation, feed retrieval, story viewers, reactions, highlights, and deletion.
  - Profile pages with posts, saved posts, tagged posts, blocked users, and editable account information.

- 💬 **Realtime messaging**
  - One-to-one and group conversations.
  - Message send, recall, delete-for-me, read receipts, typing indicators, pinned messages, member updates, nicknames, roles, leave/kick/disband group flows.
  - STOMP topics such as `/topic/conversation/{conversationId}`, `/topic/user/{userId}/conversations`, and `/topic/user/{userId}/calls`.

- 📞 **Call signaling**
  - WebSocket signaling for audio/video call events including call, answer, ICE candidate, reject, and end-call flows.

- 👥 **Friends & blocking**
  - Send, accept, reject, and cancel friend requests.
  - View friends, incoming requests, sent requests, blocked users, and unblock flows.

- 📄 **Pages module**
  - Create, update, delete, like, follow, and manage social pages.
  - Page posts, member authorization, join requests, approvals, rejections, and pending request management.

- 🤖 **AI chat assistance**
  - User consent gate for AI features.
  - Conversation summarization and smart reply suggestions through `/api/ai/summarize` and `/api/ai/suggestions`.

- 🎵 **Music/media integrations**
  - Music listing/search endpoints.
  - Cloudflare R2/S3-compatible media handling for music assets.

## 🛠 Tech Stack

| Layer | Technologies |
| --- | --- |
| Backend | Java 21, Spring Boot 3.5.6, Spring Web, Spring Security, Spring WebSocket, Spring WebFlux |
| Persistence | MariaDB, Spring Data JPA, MongoDB, Spring Data MongoDB |
| Realtime | STOMP, SockJS, Spring Simple Broker, Redis Pub/Sub |
| Auth | AWS Cognito, JWT, secure cookies/token refresh |
| Storage | AWS S3 SDK, S3 presigned URLs, Cloudflare R2-compatible storage |
| AI | OpenRouter-compatible provider integration via Spring WebClient |
| Web Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, Ant Design, Redux Toolkit, React Router |
| Mobile Frontend | Expo 54, React Native 0.81, Expo Router, Expo Secure Store, Expo Camera |
| Tooling | Maven Wrapper, npm, ESLint, Docker Compose |

## 📂 Project Structure

```text
wisdom-social/
├── backend/
│   ├── docker/
│   │   └── docker-compose.yml        # Redis service for chat/event infrastructure
│   ├── src/main/java/iuh/fit/edu/backend/
│   │   ├── config/                   # Security, CORS, Redis, Mongo, S3, WebSocket, AI config
│   │   ├── controller/               # REST and WebSocket entry points
│   │   ├── controller/ai/            # AI summary, suggestions, and consent APIs
│   │   ├── domain/entity/            # MySQL and MongoDB domain models
│   │   ├── dto/                      # Request/response contracts
│   │   ├── event/                    # Chat/conversation/user event publishing and handlers
│   │   ├── integration/ai/           # OpenRouter provider adapter
│   │   ├── repository/               # MySQL and MongoDB repositories
│   │   ├── service/                  # Business logic by domain
│   │   └── util/                     # Shared backend helpers
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml
│
├── frontend-web/
│   ├── src/
│   │   ├── api/                      # Axios client and mock data
│   │   ├── components/               # UI modules for layout, posts, messages, profile, friends
│   │   ├── contexts/                 # Auth, theme, friend notification/data providers
│   │   ├── features/chat-ai/         # AI chat UI, hooks, services, and types
│   │   ├── hooks/                    # Chat, calls, layout, current user, group management
│   │   ├── pages/                    # Route-level screens
│   │   ├── services/                 # API services and WebSocket singleton
│   │   ├── stores/                   # Runtime chat state
│   │   ├── types/                    # Shared TypeScript models
│   │   └── utils/                    # Auth, cookies, storage, validation, chat helpers
│   └── vite.config.ts                # Vite proxy for /api and /ws
│
└── frontend-mobile/
    ├── app/                          # Expo Router route groups
    ├── api/                          # Mobile Axios client with token refresh
    ├── components/                   # Reusable React Native UI components
    ├── constants/                    # Theme, spacing, typography, mock constants
    ├── hooks/                        # Chat, audio, media, group management hooks
    ├── screens/                      # Feature screens
    ├── services/                     # Auth, chat, page, post, device, WebSocket services
    ├── stores/                       # Runtime chat state
    ├── types/                        # Mobile TypeScript models
    └── utils/                        # Storage, formatters, validators, chat helpers
```

## ⚙️ Installation

### Prerequisites

- Java 21
- Node.js 20+ and npm
- MariaDB running locally on port `3306`
- MongoDB connection string
- Redis running locally on port `6379`
- AWS Cognito and S3-compatible credentials for auth/media workflows
- Optional: Cloudflare R2 credentials for music media
- Optional: OpenRouter-compatible AI provider credentials

### 1. Clone the repository

```bash
git clone https://github.com/HuuThai2910/wisdom-social.git
cd wisdom-social
```

### 2. Start Redis

The backend includes a Docker Compose file for Redis:

```bash
cd backend
docker compose -f docker/docker-compose.yml up -d
```

### 3. Configure backend environment

Update `backend/src/main/resources/application.properties` or provide environment variables for your local machine:

```properties
spring.datasource.url=jdbc:mariadb://localhost:3306/wisdom-social?createDatabaseIfNotExist=true
spring.datasource.username=your_mariadb_user
spring.datasource.password=your_mariadb_password

spring.data.mongodb.uri=your_mongodb_uri
spring.data.redis.host=localhost
spring.data.redis.port=6379
spring.data.redis.password=your_redis_password

aws.access-key=your_aws_access_key
aws.secret-key=your_aws_secret_key
aws.region=your_aws_region
aws.cognito.clientId=your_cognito_client_id
aws.cognito.userPoolId=your_cognito_user_pool_id
aws.s3.bucket-name=your_s3_bucket

app.cdn-domain=your_cdn_domain

ai.provider.base-url=your_ai_provider_base_url
ai.provider.api-key=your_ai_provider_api_key
ai.provider.model=your_ai_model
```

### 4. Install frontend dependencies

```bash
cd frontend-web
npm install
```

```bash
cd frontend-mobile
npm install
```

## ▶️ Usage

### Run the backend

```bash
cd backend
./mvnw spring-boot:run
```

On Windows PowerShell:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The backend runs on:

```text
http://localhost:8080
```

### Run the web app

```bash
cd frontend-web
npm run dev
```

The Vite dev server runs on:

```text
http://localhost:5173
```

The web app proxies API and WebSocket traffic to the backend:

```text
/api -> http://localhost:8080
/ws  -> http://localhost:8080/ws
```

### Run the mobile app

```bash
cd frontend-mobile
npm start
```

Common Expo targets:

```bash
npm run android
npm run ios
npm run web
```

The mobile API client resolves the backend from the Expo LAN host when available and falls back to emulator/local network addresses.

### Build and lint

```bash
cd frontend-web
npm run build
npm run lint
```

```bash
cd frontend-mobile
npm run lint
```

```bash
cd backend
./mvnw test
```

## 🔌 API

The backend exposes REST endpoints under `/api` and STOMP/WebSocket endpoints under `/ws` and `/ws-native`.

| Domain | Main endpoints | Purpose |
| --- | --- | --- |
| Auth | `/api/auth/register`, `/api/auth/confirm`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/me` | Cognito auth, profile session, refresh token flow |
| QR Session | `/api/session/qr-login/create`, `/api/session/qr-login/status/{sessionId}`, `/api/session/qr-login/confirm`, `/api/session/qr-login/access-token` | Web/mobile QR login handshake |
| Users | `/api/auth/users`, `/api/auth/user/{id}`, `/api/auth/users/block`, `/api/auth/users/cancel-block` | User search, admin/update flows, blocking |
| Friends | `/api/friends/request`, `/api/friends/accept`, `/api/friends/reject`, `/api/friends/{userId}` | Friend request lifecycle and friend list |
| Posts | `/api/posts`, `/api/posts/{id}`, `/api/posts/user/{userId}`, `/api/posts/upload-url`, `/api/posts/tagged/{userId}` | Feed posts, uploads, user posts, tagged posts |
| Comments | `/api/comments`, `/api/comments/{commentId}/replies` | Post comments and replies |
| Reactions | `/api/reactions/toggle`, `/api/reactions`, `/api/reactions/user` | Post reaction state |
| Saved posts | `/api/saved-posts/toggle`, `/api/saved-posts/user`, `/api/saved-posts/check` | Save/unsave and saved post collections |
| Stories | `/api/stories`, `/api/stories/feed`, `/api/stories/{storyId}/view`, `/api/stories/{storyId}/react` | Story publishing, viewing, reactions, highlights |
| Pages | `/api/page/create`, `/api/page/{id}`, `/api/page/my-pages`, `/api/page/post/add` | Page profiles, interactions, page posts |
| Page members | `/api/page-member/add`, `/api/page-member/request-join`, `/api/page-member/approve-join` | Page membership and moderation |
| Conversations | `/api/conversations`, `/api/conversations/{id}/messages`, `/api/conversations/group` | Chat list, message pagination, group creation |
| Messages | `/api/messages/send`, `/api/messages/{messageId}/recall`, `/api/messages/{messageId}/pin` | Message delivery, recall, delete-for-me, pins |
| Files | `/api/files/presigned-url` | Upload URL generation |
| Music | `/api/music`, `/api/music/search/title`, `/api/music/search/artist` | Music metadata browsing/search |
| AI | `/api/users/me/confirm-ai`, `/api/ai/summarize`, `/api/ai/suggestions` | AI consent, conversation summaries, reply suggestions |

### WebSocket destinations

| Destination | Direction | Purpose |
| --- | --- | --- |
| `/app/chat/{conversationId}/typing` | Client -> Server | Publish typing status |
| `/app/call.signal` | Client -> Server | Publish audio/video call signaling payload |
| `/topic/conversation/{conversationId}` | Server -> Client | Messages, recalls, seen events, typing events |
| `/topic/conversations/{conversationId}/pins` | Server -> Client | Pinned/unpinned message updates |
| `/topic/conversations/{conversationId}/members` | Server -> Client | Group member profile/nickname updates |
| `/topic/user/{userId}/conversations` | Server -> Client | Conversation list changes and group membership events |
| `/topic/user/{userId}/calls` | Server -> Client | Incoming call and call state events |

## 🧱 Architecture

Wisdom Social follows a layered full-stack architecture:

```text
React Web Client       Expo Mobile Client
       |                       |
       | REST /api             | REST /api
       | STOMP /ws             | STOMP /ws or /ws-native
       v                       v
  Spring Boot API + WebSocket Gateway
       |
       ├── Security layer: JWT validation, Cognito auth, stateless sessions
       ├── Controller layer: REST resources and STOMP message mappings
       ├── Service layer: user, post, story, page, chat, AI, storage domains
       ├── Event layer: conversation/message/member events and Redis pub/sub
       ├── Persistence: MariaDB for relational entities, MongoDB for social content
       └── External services: AWS Cognito, AWS S3, Cloudflare R2, OpenRouter AI
```

Key design choices:

- **Split data model:** relational identity/conversation entities live in MySQL/MariaDB, while document-heavy social content such as posts, comments, reactions, stories, messages, and notifications lives in MongoDB.
- **Realtime-first chat:** message, read, typing, pin, membership, and call events are broadcast through STOMP topics, with Redis available for chat/event infrastructure.
- **Client-specific API clients:** web uses browser cookies and Vite proxying, while mobile uses Expo Secure Store and LAN-aware backend URL resolution.
- **AI consent boundary:** users must explicitly enable AI usage before the backend processes messages through the AI provider.

## 🧪 Future Improvements

- Add OpenAPI/Swagger documentation generated from Spring controllers.
- Move local secrets out of committed configuration and provide `.env.example` files for backend, web, and mobile.
- Add Docker Compose profiles for MariaDB, MongoDB, Redis, and backend to simplify onboarding.
- Add CI workflows for backend tests, frontend linting, and TypeScript builds.
- Add integration tests for auth, QR login, conversation events, and AI consent errors.
- Introduce push notifications for mobile chat, friend requests, calls, and story activity.
- Add production deployment documentation for backend, web, mobile builds, and object storage/CDN setup.

## 👨‍💻 Author

**HuuThai2910**  
GitHub: [github.com/HuuThai2910](https://github.com/HuuThai2910)  
Repository: [HuuThai2910/wisdom-social](https://github.com/HuuThai2910/wisdom-social)

Latest local commit author detected in this checkout: **NguyenTanNghi**.
