import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Public pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlantsPage from './pages/PlantsPage';
import PlantDetailPage from './pages/PlantDetailPage';
import SymptomsPage from './pages/SymptomsPage';
import IdentifyPage from './pages/IdentifyPage';
import ArticlesPage from './pages/ArticlesPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import AboutPage from './pages/AboutPage';
import MapPage from './pages/MapPage';

// Dashboard pages
import UserDashboard from './pages/UserDashboard';
import ProfilePage from './pages/ProfilePage';
import FavoritesPage from './pages/FavoritesPage';
import HistoryPage from './pages/HistoryPage';
import PractitionerDashboard from './pages/PractitionerDashboard';
import KnowledgeSubmissionForm from './pages/KnowledgeSubmissionForm';
import ExpertDashboard from './pages/ExpertDashboard';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/plants" element={<PlantsPage />} />
        <Route path="/plants/:id" element={<PlantDetailPage />} />
        <Route path="/symptoms" element={<SymptomsPage />} />
        <Route path="/identify" element={<IdentifyPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:slug" element={<ArticleDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/map" element={<MapPage />} />
      </Route>

      {/* Dashboard routes (all authenticated) */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/history" element={<HistoryPage />} />

        {/* Practitioner routes */}
        <Route path="/practitioner/dashboard" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><PractitionerDashboard /></ProtectedRoute>
        } />
        <Route path="/practitioner/contributions" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><PractitionerDashboard /></ProtectedRoute>
        } />
        <Route path="/practitioner/contributions/new" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><KnowledgeSubmissionForm /></ProtectedRoute>
        } />

        {/* Expert routes */}
        <Route path="/expert/dashboard" element={
          <ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertDashboard /></ProtectedRoute>
        } />
        <Route path="/expert/reviews" element={
          <ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertDashboard /></ProtectedRoute>
        } />
        <Route path="/expert/evidence" element={
          <ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertDashboard /></ProtectedRoute>
        } />
        <Route path="/expert/safety" element={
          <ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertDashboard /></ProtectedRoute>
        } />
        <Route path="/expert/preservation" element={
          <ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertDashboard /></ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/plants" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/knowledge" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/practitioners" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/articles" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/evidence" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/safety" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/geography" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/preservation" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/audit" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
