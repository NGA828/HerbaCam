import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import ToastViewport from './components/ui/Toast';

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
import { NotificationsPage, ContributionsPage, SubmissionDetailPage, ReviewsPage, RecordManager, AdminUsersPage, PreservationPage } from './pages/AuthenticatedPages';
import {
  PlantsManagement, KnowledgeManagement, ArticlesManagement, AuditLogs,
  SettingsPage, GeographyManagement, PractitionersAdmin, AdminAnalytics,
  SymptomsManagement,
} from './pages/AdminWorkspaces';
import ExpertAnalyticsPage from './pages/ExpertAnalyticsPage';
import SymptomDetailPage from './pages/SymptomDetailPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-stone-50">
        <div className="animate-spin w-9 h-9 border-[3px] border-emerald-600 border-t-transparent rounded-full" />
        <p className="text-sm text-stone-400 animate-pulse">Loading your workspace…</p>
      </div>
    );
  }
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
        <Route path="/symptoms/:id" element={<SymptomDetailPage />} />
        <Route path="/identify" element={<IdentifyPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:slug" element={<ArticleDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/map" element={<MapPage />} />
      </Route>

      {/* Dashboard routes (all authenticated) */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/user/profile" element={<ProfilePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/user/favorites" element={<FavoritesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/user/history" element={<HistoryPage />} />
        <Route path="/user/identify" element={<IdentifyPage />} />
        <Route path="/user/identify/:id" element={<IdentifyPage />} />
        <Route path="/user/symptoms" element={<SymptomsPage />} />
        <Route path="/user/plants/:id" element={<PlantDetailPage />} />
        <Route path="/user/notifications" element={<NotificationsPage />} />

        {/* Practitioner routes */}
        <Route path="/practitioner/dashboard" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><PractitionerDashboard /></ProtectedRoute>
        } />
        <Route path="/practitioner/contributions" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><ContributionsPage /></ProtectedRoute>
        } />
        <Route path="/practitioner/contributions/:id" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><SubmissionDetailPage /></ProtectedRoute>
        } />
        <Route path="/practitioner/profile" element={<ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><ProfilePage /></ProtectedRoute>} />
        <Route path="/practitioner/contributions/new" element={
          <ProtectedRoute roles={['PRACTITIONER', 'ADMIN']}><KnowledgeSubmissionForm /></ProtectedRoute>
        } />

        {/* Expert routes */}
        <Route path="/expert/dashboard" element={
          <ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertDashboard /></ProtectedRoute>
        } />
        <Route path="/expert/reviews" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><ReviewsPage /></ProtectedRoute>} />
        <Route path="/expert/reviews/:id" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><SubmissionDetailPage review /></ProtectedRoute>} />
        <Route path="/expert/evidence" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><RecordManager kind="evidence" /></ProtectedRoute>} />
        <Route path="/expert/evidence/new" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><RecordManager kind="evidence" /></ProtectedRoute>} />
        <Route path="/expert/evidence/:id/edit" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><RecordManager kind="evidence" /></ProtectedRoute>} />
        <Route path="/expert/safety" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><RecordManager kind="safety" /></ProtectedRoute>} />
        <Route path="/expert/preservation" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><PreservationPage /></ProtectedRoute>} />
        <Route path="/expert/analytics" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><ExpertAnalyticsPage /></ProtectedRoute>} />
        <Route path="/expert/knowledge" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><KnowledgeManagement /></ProtectedRoute>} />
        <Route path="/expert/notifications" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><NotificationsPage /></ProtectedRoute>} />
        <Route path="/expert/profile" element={<ProtectedRoute roles={['EXPERT', 'ADMIN']}><ProfilePage /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={<ProtectedRoute roles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/users/:id" element={<ProtectedRoute roles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/plants" element={<ProtectedRoute roles={['ADMIN']}><PlantsManagement /></ProtectedRoute>} />
        <Route path="/admin/plants/new" element={<ProtectedRoute roles={['ADMIN']}><PlantsManagement /></ProtectedRoute>} />
        <Route path="/admin/plants/:id/edit" element={<ProtectedRoute roles={['ADMIN']}><PlantsManagement /></ProtectedRoute>} />
        <Route path="/admin/knowledge" element={<ProtectedRoute roles={['ADMIN']}><KnowledgeManagement /></ProtectedRoute>} />
        <Route path="/admin/symptoms" element={<ProtectedRoute roles={['ADMIN']}><SymptomsManagement /></ProtectedRoute>} />
        <Route path="/admin/practitioners" element={
          <ProtectedRoute roles={['ADMIN']}><PractitionersAdmin /></ProtectedRoute>
        } />
        <Route path="/admin/articles" element={<ProtectedRoute roles={['ADMIN']}><ArticlesManagement /></ProtectedRoute>} />
        <Route path="/admin/evidence" element={<ProtectedRoute roles={['ADMIN']}><RecordManager kind="evidence" /></ProtectedRoute>} />
        <Route path="/admin/safety" element={<ProtectedRoute roles={['ADMIN']}><RecordManager kind="safety" /></ProtectedRoute>} />
        <Route path="/admin/geography" element={<ProtectedRoute roles={['ADMIN']}><GeographyManagement /></ProtectedRoute>} />
        <Route path="/admin/preservation" element={<ProtectedRoute roles={['ADMIN']}><PreservationPage /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={
          <ProtectedRoute roles={['ADMIN']}><AdminAnalytics /></ProtectedRoute>
        } />
        <Route path="/admin/audit" element={<ProtectedRoute roles={['ADMIN']}><AuditLogs /></ProtectedRoute>} />
        <Route path="/admin/audit-logs" element={<ProtectedRoute roles={['ADMIN']}><AuditLogs /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute roles={['ADMIN']}><SettingsPage /></ProtectedRoute>} />
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
          <ToastProvider>
            <ConfirmProvider>
              <AppRoutes />
              <ToastViewport />
            </ConfirmProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
