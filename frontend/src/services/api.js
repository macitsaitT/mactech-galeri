import axios from 'axios';

// Backend URL - Railway veya local
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
const API_URL = BACKEND_URL + '/api';

console.log('[API] Backend URL:', BACKEND_URL);
console.log('[API] Full API URL:', API_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 saniye timeout
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  deleteAccount: () => api.delete('/auth/delete-account'),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
  // QR Login endpoints
  generateQRSession: () => api.post('/auth/qr/generate'),
  checkQRStatus: (sessionId) => api.get(`/auth/qr/status/${sessionId}`),
  scanQRCode: (sessionId) => api.post('/auth/qr/scan', { session_id: sessionId }),
  approveQRLogin: (sessionId) => api.post('/auth/qr/approve', { session_id: sessionId }),
  rejectQRLogin: (sessionId) => api.post('/auth/qr/reject', { session_id: sessionId }),
  // SSO Login endpoint
  ssoLogin: (ssoToken) => api.post('/auth/sso-login', { sso_token: ssoToken }),
};

export const fileAPI = {
  upload: (formData) => api.post('/upload', formData, { 
    headers: { 'Content-Type': undefined },
    timeout: 120000 // 2 dakika timeout
  }),
  
  // Base64 ile yükleme - Network Error sorununu çözer
  uploadBase64: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(',')[1]; // data:image/...;base64, kısmını çıkar
          const formData = new FormData();
          formData.append('filename', file.name);
          formData.append('data', base64Data);
          
          const response = await api.post('/upload-base64', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000
          });
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  
  // Chunked upload - Çok büyük dosyalar için
  uploadChunked: async (file, onProgress) => {
    const CHUNK_SIZE = 512 * 1024; // 512KB chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const chunkBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(chunk);
      });
      
      const formData = new FormData();
      formData.append('upload_id', uploadId);
      formData.append('chunk_index', i.toString());
      formData.append('total_chunks', totalChunks.toString());
      formData.append('filename', file.name);
      formData.append('chunk_data', chunkBase64);
      
      const response = await api.post('/upload-chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      
      if (response.data.status === 'complete') {
        return response;
      }
    }
  },
  
  // Otomatik yöntem seçimi - En uygun yöntemi kullanır
  smartUpload: async (file, onProgress) => {
    // 2MB'dan büyük dosyalar için chunked upload
    if (file.size > 2 * 1024 * 1024) {
      return fileAPI.uploadChunked(file, onProgress);
    }
    // 2MB'dan küçük dosyalar için base64 upload
    return fileAPI.uploadBase64(file);
  },
  
  getUrl: (path) => {
    const token = localStorage.getItem('crm_token');
    return `${API_URL}/files/${path}?auth=${token}`;
  },
};

export const exportAPI = {
  cars: () => api.get('/export/cars', { responseType: 'blob' }),
  customers: () => api.get('/export/customers', { responseType: 'blob' }),
  transactions: () => api.get('/export/transactions', { responseType: 'blob' }),
  expertisePdf: (carId) => api.get(`/export/expertise/${carId}`, { responseType: 'blob' }),
};

// ==================== CARS ====================
export const carsAPI = {
  getAll: () => api.get('/cars'),
  create: (data) => api.post('/cars', data),
  update: (id, data) => api.put(`/cars/${id}`, data),
  patch: (id, data) => api.patch(`/cars/${id}`, data),
  delete: (id, permanent = false) => api.delete(`/cars/${id}?permanent=${permanent}`),
  restore: (id) => api.post(`/cars/${id}/restore`),
};

// ==================== CUSTOMERS ====================
export const customersAPI = {
  getAll: () => api.get('/customers'),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id, permanent = false) => api.delete(`/customers/${id}?permanent=${permanent}`),
  restore: (id) => api.post(`/customers/${id}/restore`),
};

// ==================== TRANSACTIONS ====================
export const transactionsAPI = {
  getAll: () => api.get('/transactions'),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id, permanent = false) => api.delete(`/transactions/${id}?permanent=${permanent}`),
  restore: (id) => api.post(`/transactions/${id}/restore`),
};

// ==================== STATS ====================
export const statsAPI = {
  get: () => api.get('/stats'),
};

// ==================== USERS ====================
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getEmployees: () => api.get('/employees'),
};

// ==================== APPOINTMENTS ====================
export const appointmentsAPI = {
  getAll: () => api.get('/appointments'),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id, permanent = false) => api.delete(`/appointments/${id}?permanent=${permanent}`),
  restore: (id) => api.post(`/appointments/${id}/restore`),
};

export const permissionsAPI = {
  get: () => api.get('/permissions'),
  update: (data) => api.put('/permissions', data),
};

export const yearEndAPI = {
  getTransfers: () => api.get('/year-end-transfers'),
  createTransfer: (year) => api.post('/year-end-transfer', { year }),
};

// ==================== INVOICES ====================
export const invoicesAPI = {
  getInvoiceHtml: (carId) => api.get(`/invoices/${carId}`),
};

// ==================== NOTIFICATIONS ====================
export const notificationsAPI = {
  getNotifications: (unreadOnly = false) => api.get('/notifications', { params: { unread_only: unreadOnly } }),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  createReminder: (data) => api.post('/notifications/reminders', data),
  getCarReminders: (carId) => api.get(`/notifications/reminders/${carId}`),
  deleteReminder: (reminderId) => api.delete(`/notifications/reminders/${reminderId}`),
  checkAndCreate: () => api.post('/notifications/check-and-create'),
  generateICS: (carId, eventType) => api.get(`/notifications/generate-ics/${carId}`, { params: { event_type: eventType } })
};

// ==================== FEATURES ====================
export const featuresAPI = {
  getFeatures: () => api.get('/features'),
  createFeature: (data) => api.post('/features', data),
  updateFeature: (id, data) => api.put(`/features/${id}`, data),
  deleteFeature: (id) => api.delete(`/features/${id}`),
  initDefaults: () => api.post('/features/init-defaults')
};

export default api;
