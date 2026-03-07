import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, carsAPI, customersAPI, transactionsAPI, statsAPI, appointmentsAPI, permissionsAPI } from '../services/api';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('crm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('crm_token'));

  // Data state
  const [cars, setCars] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [permissions, setPermissions] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('crm_theme');
    return saved || 'dark';
  });

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('crm_theme', theme);
  }, [theme]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const [carsRes, customersRes, transactionsRes, statsRes, appointmentsRes, permRes] = await Promise.all([
        carsAPI.getAll(),
        customersAPI.getAll(),
        transactionsAPI.getAll(),
        statsAPI.get(),
        appointmentsAPI.getAll(),
        permissionsAPI.get().catch(() => ({ data: null })),
      ]);

      setCars(carsRes.data || []);
      setCustomers(customersRes.data || []);
      setTransactions(transactionsRes.data || []);
      setStats(statsRes.data || null);
      setAppointments(appointmentsRes.data || []);
      if (permRes.data) {
        setPermissions({
          role_defaults: permRes.data.role_defaults || permRes.data.permissions || null,
          user_overrides: permRes.data.user_overrides || {}
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  // Auth functions
  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token, user: userData } = response.data;
    
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(userData));
    
    setUser(userData);
    setIsAuthenticated(true);
    
    if (userData.theme) {
      setTheme(userData.theme);
    }
    
    return userData;
  };

  const register = async (email, password, companyName, phone = '') => {
    const response = await authAPI.register({ email, password, company_name: companyName, phone });
    const { token, user: userData, verification_code, requires_verification } = response.data;
    
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(userData));
    
    setUser(userData);
    setIsAuthenticated(true);
    
    if (requires_verification) {
      return { verification_code };
    }
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
    setIsAuthenticated(false);
    setCars([]);
    setCustomers([]);
    setTransactions([]);
    setStats(null);
  };

  const deleteAccount = async () => {
    await authAPI.deleteAccount();
    logout();
  };

  const updateProfile = async (data) => {
    const response = await authAPI.updateProfile(data);
    const updatedUser = response.data;
    
    localStorage.setItem('crm_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    
    if (data.theme) {
      setTheme(data.theme);
    }
    
    return updatedUser;
  };

  // Car functions
  const addCar = async (carData) => {
    const response = await carsAPI.create(carData);
    setCars(prev => [...prev, response.data]);
    await refreshStats();
    return response.data;
  };

  const updateCar = async (id, carData) => {
    const response = await carsAPI.update(id, carData);
    setCars(prev => prev.map(c => c.id === id ? response.data : c));
    await refreshStats();
    return response.data;
  };

  const patchCar = async (id, updates) => {
    const response = await carsAPI.patch(id, updates);
    setCars(prev => prev.map(c => c.id === id ? response.data : c));
    await refreshStats();
    return response.data;
  };

  const deleteCar = async (id, permanent = false) => {
    await carsAPI.delete(id, permanent);
    if (permanent) {
      setCars(prev => prev.filter(c => c.id !== id));
      setTransactions(prev => prev.filter(t => t.car_id !== id));
    } else {
      setCars(prev => prev.map(c => c.id === id ? { ...c, deleted: true } : c));
      setTransactions(prev => prev.map(t => t.car_id === id ? { ...t, deleted: true } : t));
    }
    await refreshStats();
  };

  const restoreCar = async (id) => {
    const response = await carsAPI.restore(id);
    setCars(prev => prev.map(c => c.id === id ? { ...c, deleted: false } : c));
    setTransactions(prev => prev.map(t => t.car_id === id ? { ...t, deleted: false } : t));
    await refreshStats();
    return response.data;
  };

  // Customer functions
  const addCustomer = async (customerData) => {
    const response = await customersAPI.create(customerData);
    setCustomers(prev => [...prev, response.data]);
    await refreshStats();
    return response.data;
  };

  const updateCustomer = async (id, customerData) => {
    const response = await customersAPI.update(id, customerData);
    setCustomers(prev => prev.map(c => c.id === id ? response.data : c));
    return response.data;
  };

  const deleteCustomer = async (id, permanent = false) => {
    await customersAPI.delete(id, permanent);
    if (permanent) {
      setCustomers(prev => prev.filter(c => c.id !== id));
    } else {
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted: true } : c));
    }
    await refreshStats();
  };

  const restoreCustomer = async (id) => {
    const response = await customersAPI.restore(id);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted: false } : c));
    await refreshStats();
    return response.data;
  };

  // Transaction functions
  const addTransaction = async (transactionData) => {
    const response = await transactionsAPI.create(transactionData);
    setTransactions(prev => [...prev, response.data]);
    await refreshStats();
    return response.data;
  };

  const updateTransaction = async (id, updates) => {
    const response = await transactionsAPI.update(id, updates);
    setTransactions(prev => prev.map(t => t.id === id ? response.data : t));
    await refreshStats();
    return response.data;
  };

  const deleteTransaction = async (id, permanent = false) => {
    await transactionsAPI.delete(id, permanent);
    if (permanent) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    } else {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, deleted: true, deleted_at: new Date().toISOString() } : t));
    }
    await refreshStats();
  };

  const restoreTransaction = async (id) => {
    const response = await transactionsAPI.restore(id);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...response.data, deleted: false, deleted_at: null } : t));
    await refreshStats();
  };

  // Refresh stats
  const refreshStats = async () => {
    try {
      const response = await statsAPI.get();
      setStats(response.data);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Appointments
  const addAppointment = async (data) => {
    const response = await appointmentsAPI.create(data);
    setAppointments(prev => [...prev, response.data]);
    return response.data;
  };

  const updateAppointment = async (id, data) => {
    const response = await appointmentsAPI.update(id, data);
    setAppointments(prev => prev.map(a => a.id === id ? response.data : a));
    return response.data;
  };

  const deleteAppointment = async (id, permanent = false) => {
    await appointmentsAPI.delete(id, permanent);
    if (permanent) {
      setAppointments(prev => prev.filter(a => a.id !== id));
    } else {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, deleted: true, deleted_at: new Date().toISOString() } : a));
    }
  };

  const restoreAppointment = async (id) => {
    const response = await appointmentsAPI.restore(id);
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...response.data, deleted: false, deleted_at: null } : a));
  };

  const value = {
    // Auth
    user,
    isAuthenticated,
    login,
    register,
    logout,
    deleteAccount,
    updateProfile,

    // Data
    cars,
    customers,
    transactions,
    stats,
    appointments,
    loading,
    fetchData,
    refreshStats,

    // Cars
    addCar,
    updateCar,
    patchCar,
    deleteCar,
    restoreCar,

    // Customers
    addCustomer,
    updateCustomer,
    deleteCustomer,
    restoreCustomer,

    // Transactions
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,

    // Appointments
    addAppointment,
    updateAppointment,
    deleteAppointment,
    restoreAppointment,

    // Permissions
    permissions,
    setPermissions,
    hasPermission: (key) => {
      const role = user?.role;
      if (role === 'admin') return true;
      if (!permissions) return false;
      // Check user-specific override first
      const userId = user?.id;
      const userOverride = permissions.user_overrides?.[userId];
      if (userOverride && key in userOverride) return userOverride[key] === true;
      // Fall back to role defaults
      const roleDefaults = permissions.role_defaults || permissions;
      if (!roleDefaults?.[role]) return false;
      return roleDefaults[role][key] === true;
    },

    // Theme
    theme,
    setTheme,
    toggleTheme,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
