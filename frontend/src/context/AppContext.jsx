import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI, carsAPI, customersAPI, transactionsAPI, statsAPI, appointmentsAPI, permissionsAPI, capitalAPI } from '../services/api';
import api from '../services/api';
import { notifyEvent } from '../utils/notifications';
import { toast } from 'sonner';

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
  // ✅ Yetki sürüm tag'i — admin yetkileri değiştirince polling ile farkı algılayıp toast + refetch yaparız
  const permVersionRef = useRef('0');
  const [orgOwner, setOrgOwner] = useState(null);
  const [capital, setCapital] = useState({ amount: 0 }); // ✅ Kasa / Sermaye bakiyesi
  // ✅ Aktif şube filtresi — tüm sayfalara yayılır. Boş '' → tümü (birleşik görünüm).
  const [selectedBranchId, setSelectedBranchId] = useState(() => localStorage.getItem('crm_selected_branch') || '');
  const [branches, setBranches] = useState([]);

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
  // ✅ silent=true → setLoading tetiklenmez (App.js'teki global "Yükleniyor..." overlay'i çıkmaz).
  // Bu, açık modal'lar (Sermaye, vb.) silme/işlem sonrası unmount olmasın diye kritik.
  const fetchData = useCallback(async (silent = false) => {
    if (!isAuthenticated) return;
    
    if (!silent) setLoading(true);
    try {
      const params = selectedBranchId ? { branch_id: selectedBranchId } : {};
      const [carsRes, customersRes, transactionsRes, statsRes, appointmentsRes, permRes, ownerRes, capitalRes, branchesRes] = await Promise.all([
        carsAPI.getAll(params),
        customersAPI.getAll(params),
        transactionsAPI.getAll(params),
        selectedBranchId ? statsAPI.get({ branch_id: selectedBranchId }) : statsAPI.get(),
        appointmentsAPI.getAll(),
        permissionsAPI.get().catch(() => ({ data: null })),
        api.get('/org/owner').catch(() => ({ data: null })),
        capitalAPI.get().catch(() => ({ data: { amount: 0 } })),
        api.get('/branches').catch(() => ({ data: [] })),
      ]);

      setCars(carsRes.data || []);
      setCustomers(customersRes.data || []);
      setTransactions(transactionsRes.data || []);
      setStats(statsRes.data || null);
      setAppointments(appointmentsRes.data || []);
      setCapital(capitalRes.data || { amount: 0 });
      setBranches(branchesRes.data || []);
      if (ownerRes.data) setOrgOwner(ownerRes.data);
      if (permRes.data) {
        setPermissions({
          role_defaults: permRes.data.role_defaults || permRes.data.permissions || null,
          user_overrides: permRes.data.user_overrides || {}
        });
        // ✅ İlk yüklemede sürüm tag'ini kaydet — polling ile karşılaştırılacak
        permVersionRef.current = permRes.data.version || '0';
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated, selectedBranchId]);

  // Seçili şube değişince localStorage'a yaz
  useEffect(() => {
    if (selectedBranchId) localStorage.setItem('crm_selected_branch', selectedBranchId);
    else localStorage.removeItem('crm_selected_branch');
  }, [selectedBranchId]);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  // ✅ Yetki güncellemesi polling — her 25 saniyede bir hafif version endpoint'ini çağır.
  // Sürüm değişmişse toast göster ve perms'i yenile (kullanıcı manuel logout/login yapmadan da etkili olur).
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      try {
        const res = await permissionsAPI.getVersion();
        const newVersion = res.data?.version || '0';
        if (permVersionRef.current && permVersionRef.current !== '0' && newVersion !== permVersionRef.current) {
          permVersionRef.current = newVersion;
          // Yeni perm'leri çek
          try {
            const fullRes = await permissionsAPI.get();
            if (fullRes.data) {
              setPermissions({
                role_defaults: fullRes.data.role_defaults || fullRes.data.permissions || null,
                user_overrides: fullRes.data.user_overrides || {}
              });
              toast.info('Yetkileriniz yöneticiniz tarafından güncellendi', {
                description: 'Yeni yetkileriniz şimdi aktif.',
                duration: 5000,
              });
            }
          } catch (err) {
            console.error('Permission refetch failed:', err);
          }
        } else if (permVersionRef.current === '0' && newVersion !== '0') {
          // İlk kez set ediliyor (fetchData henüz çalışmadıysa)
          permVersionRef.current = newVersion;
        }
      } catch (err) {
        // Sessiz fail — auth/network hataları zaten interceptor'da loglanır
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
    if (updates.status === 'Satıldı') notifyEvent('car_sold', response.data);
    if (updates.status === 'Kapora Alındı') notifyEvent('deposit_received', response.data);
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
    notifyEvent('new_customer', response.data);
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
    await Promise.all([refreshStats(), refreshCapital()]);
    return response.data;
  };

  // ✅ Toplu transaction kaydı — tek istekle birden çok tx oluşturur, sonra tek refresh
  const addTransactionsBatch = async (transactionsArr) => {
    const response = await transactionsAPI.createBatch(transactionsArr);
    const created = response.data?.created || [];
    if (created.length > 0) {
      setTransactions(prev => [...prev, ...created]);
      await Promise.all([refreshStats(), refreshCapital()]);
    }
    return response.data; // {created, errors, created_count, error_count}
  };

  const updateTransaction = async (id, updates) => {
    const response = await transactionsAPI.update(id, updates);
    setTransactions(prev => prev.map(t => t.id === id ? response.data : t));
    await Promise.all([refreshStats(), refreshCapital()]);
    return response.data;
  };

  const deleteTransaction = async (id, permanent = false) => {
    await transactionsAPI.delete(id, permanent);
    if (permanent) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    } else {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, deleted: true, deleted_at: new Date().toISOString() } : t));
    }
    await Promise.all([refreshStats(), refreshCapital()]);
  };

  const restoreTransaction = async (id) => {
    const response = await transactionsAPI.restore(id);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...response.data, deleted: false, deleted_at: null } : t));
    await Promise.all([refreshStats(), refreshCapital()]);
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

  // ✅ Capital / Kasa
  const refreshCapital = useCallback(async () => {
    try {
      const res = await capitalAPI.get();
      setCapital(res.data || { amount: 0 });
    } catch (e) {
      // sessiz
    }
  }, []);

  const adjustCapital = async (amount, type, description = '') => {
    const res = await capitalAPI.adjust(amount, type, description);
    setCapital(res.data);
    return res.data;
  };

  const setCapitalAmount = async (amount, description = '') => {
    const res = await capitalAPI.set(amount, description);
    setCapital(res.data);
    return res.data;
  };

  const initializeCapital = async (startingAmount, description = '') => {
    const res = await capitalAPI.initialize(startingAmount, description);
    setCapital(res.data);
    // Geçmiş tx'ler capital_applied=True olduğundan refresh stat
    await refreshStats();
    return res.data;
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Appointments
  const addAppointment = async (data) => {
    const response = await appointmentsAPI.create(data);
    setAppointments(prev => [...prev, response.data]);
    notifyEvent('new_appointment', response.data);
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
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,

    // Appointments
    addAppointment,
    updateAppointment,
    deleteAppointment,
    restoreAppointment,

    // ✅ Capital / Kasa
    capital,
    refreshCapital,
    adjustCapital,
    setCapitalAmount,
    initializeCapital,

    // Permissions
    permissions,
    setPermissions,
    // ✅ Admin save sonrası kendi tarayıcısında toast almamak için sürümü bump et
    setPermissionsVersion: (v) => { permVersionRef.current = v || '0'; },
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

    // Org owner info (galeri sahibi)
    orgOwner,

    // Theme
    theme,
    setTheme,
    toggleTheme,

    // ✅ Şube filtresi (global)
    selectedBranchId,
    setSelectedBranchId,
    branches,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
