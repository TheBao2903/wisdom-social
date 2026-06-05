import {
  Routes,
  Route,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AvatarProvider } from "./context/AvatarContext";
import { FriendNotificationProvider } from "./contexts/FriendNotificationContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import FriendDataProvider from "./contexts/FriendDataContext";
import { ChatUnreadProvider } from "./contexts/ChatUnreadContext";
import MainLayout from "./components/layout/MainLayout";
import PublicLayout from "./components/layout/PublicLayout";
import RequireAuth from "./components/auth/RequireAuth";
import PostModal from "./components/post/post-modal/PostModal";
import GlobalIncomingCallNotifier from "./components/message/GlobalIncomingCallNotifier";

// Auth Pages
import Login from "./pages/LogIn";
import LoginWithEmail from "./pages/LoginWithEmail";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import CheckInbox from "./pages/CheckInbox";
import VerifyOTP from "./pages/VerifyOTP";
import ResetPassword from "./pages/ResetPassword";
import QRLogin from "./pages/QRLogin";
import GroupInvite from "./pages/GroupInvite";

// Private Pages
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import Explore from "./pages/Explore";
import Reels from "./pages/Reels";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import ProfileMyPosts from "./pages/ProfileMyPosts";
import ProfileSavedPost from "./pages/ProfileSavedPost";
import ProfileTaggedPost from "./pages/ProfileTaggedPost";
import ProfileBlocked from "./pages/ProfileBlocked";
import ProfileShared from "./pages/ProfileShared";
import ProfileGeneral from "./pages/ProfileGeneral";
import CreatePost from "./pages/CreatePost";
import CreateStory from "./pages/CreateStory";
import Settings from "./pages/Settings";
import ProfileLayout from "./components/profile/ProfileLayout";

// Pages Feature
import Pages from "./pages/Pages";
import CreatePageForm from "./pages/CreatePageForm";
import PageDetail from "./pages/PageDetail";
import PageSettings from "./pages/PageSettings";
import EditPageForm from "./pages/EditPageForm";
import PagePosts from "./pages/PagePosts";

// Other Pages
import General from "./pages/General";
import Misc from "./pages/Misc";
import EditProfile from "./pages/EditProfile";
import UserManagement from "./pages/UserManagement";
import BlockedUsers from "./pages/BlockedUsers";
import FriendRequests from "./pages/FriendRequests";

function PostModalWrapper({
  handleClose,
}: {
  backgroundLocation?: any;
  handleClose: () => void;
}) {
  const { id } = useParams();
  if (!id) return null;
  return <PostModal postId={id} onClose={handleClose} />;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Modal Gallery Pattern logic
  const state = location.state as { backgroundLocation?: Location };
  const backgroundLocation = state?.backgroundLocation;

  const handleCloseModal = () => {
    if (backgroundLocation) {
      navigate(-1);
    } else if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate("/");
    }
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <AvatarProvider>
          <FriendDataProvider>
            <FriendNotificationProvider>
              <NotificationProvider>
                <ChatUnreadProvider>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: { background: "#333", color: "#fff" },
                    }}
                  />
                  <GlobalIncomingCallNotifier />

                  <Routes location={backgroundLocation || location}>
                    {/* Public Routes */}
                    <Route element={<PublicLayout />}>
                      <Route path="/login" element={<Login />} />
                      <Route path="/login/email" element={<LoginWithEmail />} />
                      <Route path="/login/qr" element={<QRLogin />} />
                      <Route path="/signup" element={<SignUp />} />
                      <Route
                        path="/forgot-password"
                        element={<ForgotPassword />}
                      />
                      <Route path="/checkinbox" element={<CheckInbox />} />
                      <Route path="/verify-otp" element={<VerifyOTP />} />
                      <Route
                        path="/reset-password"
                        element={<ResetPassword />}
                      />
                    </Route>
                    <Route path="/g/:token" element={<GroupInvite />} />

                    {/* Private Routes */}
                    <Route
                      element={
                        <RequireAuth>
                          <MainLayout />
                        </RequireAuth>
                      }
                    >
                      <Route path="/" element={<Home />} />
                      <Route path="/feed" element={<Feed />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/reels" element={<Reels />} />
                      <Route
                        path="/notifications"
                        element={<Notifications />}
                      />

                      {/* Single Post Page (when direct URL access) */}
                      {!backgroundLocation && (
                        <Route
                          path="/post/:id"
                          element={
                            <PostModalWrapper handleClose={handleCloseModal} />
                          }
                        />
                      )}

                      <Route path="/messages" element={<Messages />} />
                      <Route
                        path="/messages/:conversationId"
                        element={<Messages />}
                      />
                      <Route
                        path="/messages/:conversationId/call"
                        element={<Messages />}
                      />
                      <Route path="/create" element={<CreatePost />} />
                      <Route path="/create-story" element={<CreateStory />} />

                      {/* Profile Routes */}
                      <Route
                        path="/profile/:username"
                        element={<ProfileLayout />}
                      >
                        <Route index element={<ProfileMyPosts />} />
                        <Route path="posts" element={<ProfileMyPosts />} />
                        <Route path="saved" element={<ProfileSavedPost />} />
                        <Route path="tagged" element={<ProfileTaggedPost />} />
                        <Route path="shared" element={<ProfileShared />} />
                        <Route path="blocked" element={<ProfileBlocked />} />
                      </Route>

                      <Route
                        path="/profile/:username/general"
                        element={<ProfileGeneral />}
                      />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/edit-profile" element={<EditProfile />} />
                      <Route
                        path="/user-management"
                        element={<UserManagement />}
                      />
                      <Route path="/blocked-users" element={<BlockedUsers />} />
                      <Route
                        path="/friend-requests"
                        element={<FriendRequests />}
                      />

                      {/* Pages Routes */}
                      <Route path="/pages" element={<Pages />} />
                      <Route
                        path="/pages/create"
                        element={<CreatePageForm />}
                      />
                      <Route path="/pages/:pageId" element={<PageDetail />} />
                      <Route
                        path="/pages/:pageId/create-post"
                        element={<CreatePost />}
                      />
                      <Route
                        path="/pages/:pageId/edit"
                        element={<EditPageForm />}
                      />
                      <Route
                        path="/pages/:pageId/posts"
                        element={<PagePosts />}
                      />
                      <Route
                        path="/pages/:pageId/settings"
                        element={<PageSettings />}
                      />
                    </Route>

                    <Route path="/general" element={<General />} />
                    <Route path="/misc" element={<Misc />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>

                  {/* Render Modal Overlay */}
                  {backgroundLocation && (
                    <Routes>
                      <Route
                        path="/post/:id"
                        element={
                          <PostModalWrapper
                            backgroundLocation={backgroundLocation}
                            handleClose={handleCloseModal}
                          />
                        }
                      />
                    </Routes>
                  )}
                </ChatUnreadProvider>
              </NotificationProvider>
            </FriendNotificationProvider>
          </FriendDataProvider>
        </AvatarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          404
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Page not found
        </p>
        <a href="/" className="text-blue-500 hover:text-blue-700 font-semibold">
          Go back home
        </a>
      </div>
    </div>
  );
}

export default App;
