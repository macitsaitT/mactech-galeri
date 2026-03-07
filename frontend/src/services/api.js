import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
};

export const fileAPI = {
  upload: (formData) => api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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

export default api;
