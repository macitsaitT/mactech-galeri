// MACTech Multi-Tenant SaaS - API Service with 402 Interceptor
// /frontend/src/services/api.js

import axios from 'axios';

// API Base URL
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Paywall state management (basit event emitter)
let paywallCallback = null;

export const setPaywallCallback = (callback) => {
  paywallCallback = callback;
};

export const triggerPaywall = (paywallData) => {
  if (paywallCallback) {
    paywallCallback(paywallData);
  }
};

// Axios instance oluştur
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== REQUEST INTERCEPTOR ====================
api.interceptors.request.use(
  (config) => {
    // JWT Token ekle
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Organization ID ekle
    const orgId = localStorage.getItem('currentOrgId');
    if (orgId) {
      config.headers['X-Organization-ID'] = orgId;
    }
    
    // Sector ID ekle (opsiyonel)
    const sectorId = localStorage.getItem('currentSectorId');
    if (sectorId) {
      config.headers['X-Sector-ID'] = sectorId;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================== RESPONSE INTERCEPTOR ====================
api.interceptors.response.use(
  // Başarılı response
  (response) => {
    return response;
  },
  
  // Hata response
  (error) => {
    const { response } = error;
    
    if (!response) {
      // Network hatası
      console.error('Network error:', error.message);
      return Promise.reject({
        error: 'network_error',
        message: 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.',
      });
    }
    
    const { status, data } = response;
    
    // ==================== 401 UNAUTHORIZED ====================
    if (status === 401) {
      console.warn('Session expired or invalid token');
      
      // Token'ı temizle
      localStorage.removeItem('token');
      localStorage.removeItem('currentOrgId');
      localStorage.removeItem('currentSectorId');
      
      // Login sayfasına yönlendir
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?session_expired=true';
      }
      
      return Promise.reject({
        error: 'unauthorized',
        message: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
      });
    }
    
    // ==================== 402 PAYMENT REQUIRED ====================
    // 🔒 ABONELİK SONA ERMİŞ - VERİLER GÜVENDE AMA KİLİTLİ
    if (status === 402) {
      console.warn('Payment required - Subscription expired');
      
      const paywallData = data.detail || data;
      
      // Paywall callback'i tetikle
      triggerPaywall({
        isVisible: true,
        sector: paywallData.sector_id,
        status: paywallData.subscription_status,
        message: paywallData.message,
        trialEndedAt: paywallData.trial_ended_at,
        dataPreserved: paywallData.data_preserved,
        plans: paywallData.plans || [],
        checkoutUrl: paywallData.checkout_url,
      });
      
      return Promise.reject({
        error: 'payment_required',
        code: paywallData.code,
        message: paywallData.message,
        paywallData,
      });
    }
    
    // ==================== 403 FORBIDDEN ====================
    if (status === 403) {
      console.warn('Access denied:', data);
      return Promise.reject({
        error: 'access_denied',
        message: data.detail?.message || 'Bu kaynağa erişim izniniz yok.',
      });
    }
    
    // ==================== 404 NOT FOUND ====================
    if (status === 404) {
      return Promise.reject({
        error: 'not_found',
        message: data.detail?.message || 'Kaynak bulunamadı.',
      });
    }
    
    // ==================== 500+ SERVER ERROR ====================
    if (status >= 500) {
      console.error('Server error:', data);
      return Promise.reject({
        error: 'server_error',
        message: 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.',
      });
    }
    
    // Diğer hatalar
    return Promise.reject({
      error: 'api_error',
      status,
      message: data.detail?.message || data.message || 'Bir hata oluştu.',
      data,
    });
  }
);

// ==================== API HELPER FUNCTIONS ====================

// Auth
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  googleAuth: (sessionId) => api.post('/api/auth/google', { session_id: sessionId }),
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentOrgId');
    localStorage.removeItem('currentSectorId');
  },
};

// Organizations
export const orgAPI = {
  list: () => api.get('/api/organizations'),
  get: (id) => api.get(`/api/organizations/${id}`),
  create: (data) => api.post('/api/organizations', data),
  update: (id, data) => api.put(`/api/organizations/${id}`, data),
  members: (id) => api.get(`/api/organizations/${id}/members`),
  inviteMember: (id, data) => api.post(`/api/organizations/${id}/members`, data),
  sectors: (id) => api.get(`/api/organizations/${id}/sectors`),
};

// Subscriptions
export const subscriptionAPI = {
  status: (sectorId) => api.get(`/api/subscriptions/status/${sectorId}`),
  plans: (sectorId) => api.get(`/api/subscriptions/plans/${sectorId}`),
  checkout: (data) => api.post('/api/subscriptions/checkout', data),
  cancel: (sectorId) => api.post('/api/subscriptions/cancel', { sector_id: sectorId }),
  summary: () => api.get('/api/subscriptions/summary'),
};

// Sector-specific APIs (dynamic)
export const createSectorAPI = (sectorId) => ({
  // Generic CRUD
  list: (resource, params = {}) => api.get(`/api/v1/${sectorId}/${resource}`, { params }),
  get: (resource, id) => api.get(`/api/v1/${sectorId}/${resource}/${id}`),
  create: (resource, data) => api.post(`/api/v1/${sectorId}/${resource}`, data),
  update: (resource, id, data) => api.put(`/api/v1/${sectorId}/${resource}/${id}`, data),
  delete: (resource, id) => api.delete(`/api/v1/${sectorId}/${resource}/${id}`),
  
  // Custom endpoints
  custom: (endpoint, method = 'get', data = null) => {
    const config = { method, url: `/api/v1/${sectorId}/${endpoint}` };
    if (data) config.data = data;
    return api(config);
  },
});

// Gallery API
export const galleryAPI = createSectorAPI('gallery');

// Realestate API
export const realestateAPI = createSectorAPI('realestate');

// Logistics API
export const logisticsAPI = createSectorAPI('logistics');

export default api;
