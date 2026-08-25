import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.patch('/auth/profile/', data),
  changePassword: (data) => api.post('/auth/change-password/', data),
};

// Plants API
export const plantsAPI = {
  list: (params) => api.get('/plants/', { params }),
  detail: (id) => api.get(`/plants/${id}/`),
  search: (params) => api.get('/plants/search/', { params }),
  adminList: (params) => api.get('/plants/admin/', { params }),
  adminCreate: (data) => api.post('/plants/admin/', data),
  adminUpdate: (id, data) => api.patch(`/plants/admin/${id}/`, data),
  adminDelete: (id) => api.delete(`/plants/admin/${id}/`),
};

// Symptoms API
export const symptomsAPI = {
  list: (params) => api.get('/symptoms/', { params }),
  detail: (id) => api.get(`/symptoms/${id}/`),
  search: (q) => api.get('/symptoms/search/', { params: { q } }),
};

// Identification API
export const identificationAPI = {
  identify: (formData) => api.post('/identification/identify/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  history: () => api.get('/identification/history/'),
  detail: (id) => api.get(`/identification/${id}/`),
  delete: (id) => api.delete(`/identification/${id}/delete/`),
  report: (id, data) => api.post(`/identification/${id}/report/`, data),
};

// Knowledge API
export const knowledgeAPI = {
  submissions: (params) => api.get('/knowledge/submissions/', { params }),
  createSubmission: (data) => api.post('/knowledge/submissions/create/', data),
  submissionDetail: (id) => api.get(`/knowledge/submissions/${id}/`),
  updateSubmission: (id, data) => api.patch(`/knowledge/submissions/${id}/`, data),
  pending: () => api.get('/knowledge/submissions/pending/'),
  review: (id, data) => api.post(`/knowledge/submissions/${id}/review/`, data),
  traditionalUses: (params) => api.get('/knowledge/traditional-uses/', { params }),
  preparationMethods: () => api.get('/knowledge/preparation-methods/'),
};

// Evidence API
export const evidenceAPI = {
  list: (params) => api.get('/evidence/', { params }),
  detail: (id) => api.get(`/evidence/${id}/`),
  create: (data) => api.post('/evidence/create/', data),
  update: (id, data) => api.patch(`/evidence/${id}/update/`, data),
};

// Safety API
export const safetyAPI = {
  list: (params) => api.get('/safety/', { params }),
  detail: (id) => api.get(`/safety/${id}/`),
  create: (data) => api.post('/safety/create/', data),
  update: (id, data) => api.patch(`/safety/${id}/update/`, data),
};

// Geography API
export const geographyAPI = {
  regions: (params) => api.get('/geography/regions/', { params }),
  regionDetail: (id) => api.get(`/geography/regions/${id}/`),
  divisions: (params) => api.get('/geography/divisions/', { params }),
  communities: (params) => api.get('/geography/communities/', { params }),
  createRegion: (data) => api.post('/geography/regions/?detailed=1', data),
  updateRegion: (id, data) => api.patch(`/geography/regions/${id}/`, data),
};

// Articles API
export const articlesAPI = {
  list: (params) => api.get('/articles/', { params }),
  detail: (slug) => api.get(`/articles/${slug}/`),
  categories: () => api.get('/articles/categories/'),
  adminList: (params) => api.get('/articles/admin/', { params }),
  adminCreate: (data) => api.post('/articles/admin/', data),
  adminUpdate: (id, data) => api.patch(`/articles/admin/${id}/`, data),
  adminDelete: (id) => api.delete(`/articles/admin/${id}/`),
};

// Analytics API
export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard/'),
  favorites: () => api.get('/analytics/favorites/'),
  addFavorite: (plant_id) => api.post('/analytics/favorites/add/', { plant_id }),
  removeFavorite: (plant_id) => api.post('/analytics/favorites/remove/', { plant_id }),
  checkFavorite: (plant_id) => api.get(`/analytics/favorites/check/${plant_id}/`),
};

// Notifications API
export const notificationsAPI = {
  list: () => api.get('/notifications/'),
  unreadCount: () => api.get('/notifications/unread-count/'),
  markRead: (id) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post('/notifications/mark-all-read/'),
  delete: (id) => api.delete(`/notifications/${id}/`),
};

// Preservation API
export const preservationAPI = {
  risk: (params) => api.get('/preservation/risk/', { params }),
  riskDetail: (id) => api.get(`/preservation/risk/${id}/`),
  calculate: () => api.post('/preservation/risk/calculate/'),
};

// Audit API
export const auditAPI = {
  list: (params) => api.get('/audit/', { params }),
};

// Users API
export const usersAPI = {
  list: (params) => api.get('/auth/users/', { params }),
  detail: (id) => api.get(`/auth/users/${id}/`),
  update: (id, data) => api.patch(`/auth/users/${id}/`, data),
};

// Practitioners API
export const practitionersAPI = {
  profile: () => api.get('/practitioners/profile/'),
  updateProfile: (data) => api.patch('/practitioners/profile/', data),
  list: () => api.get('/practitioners/list/'),
};

export default api;
