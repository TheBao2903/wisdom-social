import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';
import Pages from './pages/Pages';
import PageDetail from './pages/PageDetail';
import Posts from './pages/Posts';
import Stories from './pages/Stories';
import Music from './pages/Music';
import ActivityLog from './pages/ActivityLog';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="pages" element={<Pages />} />
          <Route path="pages/:id" element={<PageDetail />} />
          <Route path="posts" element={<Posts />} />
          <Route path="stories" element={<Stories />} />
          <Route path="music" element={<Music />} />
          <Route path="reports" element={<Reports />} />
          <Route path="activity-log" element={<ActivityLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
