import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import './index.css';
import { requestNotificationPermission, startNotificationService, stopNotificationService } from './utils/notifications';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import Header from './components/layout/Header';

// Pages
import LoginPage from './pages/LoginPage';
import SSOCallbackPage from './pages/SSOCallbackPage';
import Dashboard from './pages/Dashboard';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import FinancePage from './pages/FinancePage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import CalendarPage from './pages/CalendarPage';
import UsersPage from './pages/UsersPage';
import PermissionsPage from './pages/PermissionsPage';
import YearEndTransferPage from './pages/YearEndTransferPage';

// Modals
import AddCarModal from './components/modals/AddCarModal';
import AddCustomerModal from './components/modals/AddCustomerModal';
import SaleModal from './components/modals/SaleModal';
import DepositModal from './components/modals/DepositModal';
import ReportModal from './components/modals/ReportModal';
import PromoCardModal from './components/modals/PromoCardModal';
import ExpenseModal from './components/modals/ExpenseModal';
import TransactionModal from './components/modals/TransactionModal';
import VehicleDetailModal from './components/modals/VehicleDetailModal';
import VehicleExpensesModal from './components/modals/VehicleExpensesModal';

const getViewTitle = (view) => {
  switch (view) {
    case 'dashboard': return 'Genel Bakış';
    case 'inventory': return 'Stok Araçlar';
    case 'consignment': return 'Konsinye Araçlar';
    case 'sold': return 'Satılan Araçlar';
    case 'customers': return 'Müşteriler';
    case 'finance': return 'Gelir & Gider';
    case 'trash': return 'Çöp Kutusu';
    case 'settings': return 'Ayarlar';
    case 'calendar': return 'Randevular';
    case 'users': return 'Kullanıcı Yönetimi';
    case 'year-end': return 'Yıl Sonu Devri';
    default: return 'Dashboard';
  }
};

const AppContent = () => {
  const { 
    isAuthenticated, 
    loading,
    addCar,
    updateCar,
    patchCar,
    deleteCar,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addTransaction,
    deleteTransaction,
    transactions,
    appointments,
    cars
  } = useApp();

  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Notification permission + appointment check
  useEffect(() => {
    if (isAuthenticated) {
      requestNotificationPermission();
      startNotificationService(() => appointments);
    }
    return () => stopNotificationService();
  }, [isAuthenticated, appointments]);

  // Modal states
  const [carModal, setCarModal] = useState({ open: false, car: null });
  const [customerModal, setCustomerModal] = useState({ open: false, customer: null });
  const [saleModal, setSaleModal] = useState({ open: false, car: null });
  const [depositModal, setDepositModal] = useState({ open: false, car: null });
  const [reportModal, setReportModal] = useState(false);
  const [promoCardModal, setPromoCardModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [transactionModal, setTransactionModal] = useState(false);
  const [vehicleDetailModal, setVehicleDetailModal] = useState({ open: false, car: null });
  const [vehicleExpensesModal, setVehicleExpensesModal] = useState({ open: false, car: null });

  // Handle special view changes from sidebar quick actions
  useEffect(() => {
    if (activeView === 'add-car') {
      setCarModal({ open: true, car: null });
      setActiveView('dashboard');
    } else if (activeView === 'promo-card') {
      setPromoCardModal(true);
      setActiveView('dashboard');
    } else if (activeView === 'add-expense') {
      setExpenseModal(true);
      setActiveView('dashboard');
    } else if (activeView === 'add-transaction') {
      setTransactionModal(true);
      setActiveView('dashboard');
    }
  }, [activeView]);

  // Show loading
  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen gradient-asphalt flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Car handlers
  const handleSaveCar = async (carData) => {
    if (carModal.car) {
      await updateCar(carModal.car.id, carData);
    } else {
      const newCar = await addCar(carData);
      
      // Add purchase transaction for stock cars
      if (carData.ownership === 'stock' && carData.purchase_price > 0) {
        await addTransaction({
          type: 'expense',
          category: 'Araç Alımı',
          amount: carData.purchase_price,
          date: carData.entry_date || new Date().toISOString().split('T')[0],
          description: `${carData.plate?.toUpperCase()} - ${carData.brand} ${carData.model} Alışı`,
          car_id: newCar.id
        });
      }
    }
    setCarModal({ open: false, car: null });
  };

  const handleDeleteCar = async (car) => {
    if (window.confirm(`${car.brand} ${car.model} aracını silmek istediğinize emin misiniz?`)) {
      // Soft-delete linked customer if exists
      if (car.customer_id) {
        await deleteCustomer(car.customer_id, false);
      }
      await deleteCar(car.id, false);
    }
  };

  // Customer handlers
  const handleSaveCustomer = async (customerData) => {
    if (customerModal.customer) {
      await updateCustomer(customerModal.customer.id, customerData);
    } else {
      await addCustomer(customerData);
    }
    setCustomerModal({ open: false, customer: null });
  };

  const handleDeleteCustomer = async (customer) => {
    if (window.confirm(`${customer.name} müşterisini silmek istediğinize emin misiniz?`)) {
      await deleteCustomer(customer.id, false);
    }
  };

  // Sale handler
  const handleConfirmSale = async ({ carId, price, employeeShare, employeeName, customerId, saleDate }) => {
    const car = saleModal.car;
    if (!car) return;
    if (car.status === 'Satıldı') {
      alert('Bu araç zaten satılmış!');
      setSaleModal({ open: false, car: null });
      return;
    }

    // Update car status
    await patchCar(carId, {
      status: 'Satıldı',
      sale_price: price,
      sold_date: saleDate,
      employee_share: employeeShare,
      customer_id: customerId || ''
    });

    const deposit = car.deposit_amount || 0;
    const finalIncome = price - deposit;

    // Add sale income transaction
    if (finalIncome > 0) {
      await addTransaction({
        type: 'income',
        category: 'Araç Satışı',
        amount: finalIncome,
        date: saleDate,
        description: `Satış - ${car.plate?.toUpperCase()} ${car.brand} ${car.model}${deposit > 0 ? ' (Kalan Tutar)' : ''}`,
        car_id: carId
      });
    }

    // Add employee share expense
    if (employeeShare > 0) {
      const empLabel = employeeName ? ` (${employeeName})` : '';
      await addTransaction({
        type: 'expense',
        category: 'Çalışan Payı',
        amount: employeeShare,
        date: saleDate,
        description: `Çalışan Payı${empLabel} - ${car.plate?.toUpperCase()}`,
        car_id: carId,
        employee_name: employeeName || null
      });
    }

    // Add owner payment for consignment
    if (car.ownership === 'consignment' && car.purchase_price > 0) {
      await addTransaction({
        type: 'expense',
        category: 'Araç Sahibine Ödeme',
        amount: car.purchase_price,
        date: saleDate,
        description: `Araç Sahibine Ödeme - ${car.plate?.toUpperCase()} - ${car.owner_name || 'Konsinye'}`,
        car_id: carId
      });
    }

    // Update customer type if selected
    if (customerId) {
      await updateCustomer(customerId, { type: 'Satış Yapıldı' });
    }

    setSaleModal({ open: false, car: null });
  };

  // Deposit handler
  const handleConfirmDeposit = async ({ carId, amount, existingAmount, customerId, customerName, depositDate }) => {
    const car = depositModal.car;
    if (!car) return;

    const diff = amount - existingAmount;

    // Update car with deposit + customer info
    await patchCar(carId, {
      status: 'Kapora Alındı',
      deposit_amount: amount,
      deposit_customer_id: customerId || '',
      deposit_customer_name: customerName || '',
      deposit_date: depositDate || new Date().toISOString().split('T')[0]
    });

    // Add transaction
    if (diff !== 0) {
      const customerLabel = customerName ? ` (${customerName})` : '';
      await addTransaction({
        type: diff > 0 ? 'income' : 'expense',
        category: diff > 0 ? (existingAmount === 0 ? 'Kapora' : 'Kapora Eklemesi') : 'Kapora İadesi',
        amount: Math.abs(diff),
        date: depositDate || new Date().toISOString().split('T')[0],
        description: `Kapora${customerLabel} - ${car.plate?.toUpperCase()}`,
        car_id: carId
      });
    }

    setDepositModal({ open: false, car: null });
  };

  const handleCancelDeposit = async (carId) => {
    const car = depositModal.car;
    if (!car) return;

    // Update car - clear deposit + customer info
    await patchCar(carId, {
      status: 'Stokta',
      deposit_amount: 0,
      deposit_customer_id: '',
      deposit_customer_name: '',
      deposit_date: ''
    });

    // Add refund transaction
    if (car.deposit_amount > 0) {
      const customerLabel = car.deposit_customer_name ? ` (${car.deposit_customer_name})` : '';
      await addTransaction({
        type: 'expense',
        category: 'Kapora İadesi',
        amount: car.deposit_amount,
        date: new Date().toISOString().split('T')[0],
        description: `İade${customerLabel} - ${car.plate?.toUpperCase()}`,
        car_id: carId
      });
    }

    setDepositModal({ open: false, car: null });
  };

  // Cancel sale handler - revert car status and soft-delete sale transactions + linked customer
  const handleCancelSale = async (car) => {
    if (!car || car.status !== 'Satıldı') return;
    if (!window.confirm(`${car.brand} ${car.model} satışını iptal etmek istediğinize emin misiniz? Araç tekrar stoğa alınacaktır.`)) return;

    // Determine new status based on deposit
    const newStatus = (car.deposit_amount && car.deposit_amount > 0) ? 'Kapora Alındı' : 'Stokta';

    // Revert car status
    await patchCar(car.id, {
      status: newStatus,
      sold_date: '',
      employee_share: 0,
      sold_by_user_id: '',
      sold_by_name: '',
      customer_id: ''
    });

    // Soft-delete all sale-related transactions for this car
    const saleCategories = ['Araç Satışı', 'Çalışan Payı', 'Araç Sahibine Ödeme'];
    const relatedTxs = transactions.filter(
      t => t.car_id === car.id && saleCategories.includes(t.category) && !t.deleted
    );
    for (const tx of relatedTxs) {
      await deleteTransaction(tx.id, false);
    }

    // Soft-delete linked customer if exists
    if (car.customer_id) {
      await deleteCustomer(car.customer_id, false);
    }
  };

  // FAB handler
  const handleFabClick = () => {
    if (activeView === 'customers') {
      setCustomerModal({ open: true, customer: null });
    } else {
      setCarModal({ 
        open: true, 
        car: null
      });
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - Desktop */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenReport={() => setReportModal(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <Header 
          title={getViewTitle(activeView)} 
          onMenuClick={() => setSidebarOpen(true)}
          appointments={appointments}
        />

        {/* Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {activeView === 'dashboard' && (
            <Dashboard
              onOpenReport={() => setReportModal(true)}
            />
          )}
          
          {(activeView === 'inventory' || activeView === 'consignment' || activeView === 'sold') && (
            <InventoryPage
              viewType={activeView}
              onEditCar={(car) => setCarModal({ open: true, car })}
              onViewCar={(car) => setVehicleDetailModal({ open: true, car })}
              onExpenses={(car) => setVehicleExpensesModal({ open: true, car })}
              onDeposit={(car) => setDepositModal({ open: true, car })}
              onSale={(car) => setSaleModal({ open: true, car })}
              onDeleteCar={handleDeleteCar}
              onCancelSale={handleCancelSale}
            />
          )}
          
          {activeView === 'customers' && (
            <CustomersPage
              onAddCustomer={() => setCustomerModal({ open: true, customer: null })}
              onEditCustomer={(customer) => setCustomerModal({ open: true, customer })}
              onDeleteCustomer={handleDeleteCustomer}
            />
          )}
          
          {activeView === 'finance' && <FinancePage />}
          
          {activeView === 'trash' && <TrashPage />}
          
          {activeView === 'settings' && <SettingsPage />}
          
          {activeView === 'calendar' && <CalendarPage />}
          
          {activeView === 'users' && <UsersPage />}
          {activeView === 'permissions' && <PermissionsPage />}
          {activeView === 'year-end' && <YearEndTransferPage />}
        </main>
      </div>

      {/* Bottom Nav - Mobile */}
      <BottomNav
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Modals */}
      <AddCarModal
        isOpen={carModal.open}
        onClose={() => setCarModal({ open: false, car: null })}
        onSave={handleSaveCar}
        editingCar={carModal.car}
      />

      <AddCustomerModal
        isOpen={customerModal.open}
        onClose={() => setCustomerModal({ open: false, customer: null })}
        onSave={handleSaveCustomer}
        editingCustomer={customerModal.customer}
      />

      <SaleModal
        isOpen={saleModal.open}
        onClose={() => setSaleModal({ open: false, car: null })}
        car={saleModal.car}
        onConfirmSale={handleConfirmSale}
      />

      <DepositModal
        isOpen={depositModal.open}
        onClose={() => setDepositModal({ open: false, car: null })}
        car={depositModal.car}
        onConfirmDeposit={handleConfirmDeposit}
        onCancelDeposit={handleCancelDeposit}
      />

      <ReportModal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
      />

      <PromoCardModal
        isOpen={promoCardModal}
        onClose={() => setPromoCardModal(false)}
      />

      <ExpenseModal
        isOpen={expenseModal}
        onClose={() => setExpenseModal(false)}
      />

      <TransactionModal
        isOpen={transactionModal}
        onClose={() => setTransactionModal(false)}
      />

      <VehicleDetailModal
        isOpen={vehicleDetailModal.open}
        onClose={() => setVehicleDetailModal({ open: false, car: null })}
        car={vehicleDetailModal.car}
      />

      <VehicleExpensesModal
        isOpen={vehicleExpensesModal.open}
        onClose={() => setVehicleExpensesModal({ open: false, car: null })}
        car={vehicleExpensesModal.car}
      />
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/sso-callback" element={<SSOCallbackPage />} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </AppProvider>
  );
}

export default App;
