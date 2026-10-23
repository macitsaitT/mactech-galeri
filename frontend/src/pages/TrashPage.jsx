import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatCurrency } from '../utils/helpers';
import { 
  Trash2, RotateCcw, Car, Users, AlertTriangle, 
  CreditCard, Calendar, Filter
} from 'lucide-react';

const TABS = [
  { id: 'all', label: 'Tümü', icon: Trash2 },
  { id: 'cars', label: 'Araçlar', icon: Car },
  { id: 'transactions', label: 'İşlemler', icon: CreditCard },
  { id: 'customers', label: 'Müşteriler', icon: Users },
  { id: 'appointments', label: 'Randevular', icon: Calendar },
];

const TrashItem = ({ icon: Icon, title, subtitle, deletedAt, onRestore, onDelete, testIdPrefix }) => (
  <div className="p-4 flex items-center gap-3">
    <div className="p-2 rounded-lg bg-muted/50 flex-shrink-0">
      <Icon size={16} className="text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate">{title}</p>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      {deletedAt && <p className="text-[10px] text-muted-foreground mt-0.5">Silinme: {formatDate(deletedAt)}</p>}
    </div>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={onRestore}
        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        title="Geri Yükle"
        data-testid={`restore-${testIdPrefix}`}
      >
        <RotateCcw size={16} />
      </button>
      <button
        onClick={onDelete}
        className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        title="Kalıcı Sil"
        data-testid={`perm-delete-${testIdPrefix}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
);

const TrashPage = () => {
  const { 
    cars, customers, transactions, appointments,
    restoreCar, restoreCustomer, restoreTransaction, restoreAppointment,
    deleteCar, deleteCustomer, deleteTransaction, deleteAppointment 
  } = useApp();

  const [activeTab, setActiveTab] = useState('all');

  const deletedCars = useMemo(() => 
    cars.filter(c => c.deleted).sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0)), [cars]);
  const deletedCustomers = useMemo(() => 
    customers.filter(c => c.deleted).sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0)), [customers]);
  const deletedTransactions = useMemo(() => 
    transactions.filter(t => t.deleted).sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0)), [transactions]);
  const deletedAppointments = useMemo(() => 
    appointments.filter(a => a.deleted).sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0)), [appointments]);

  const totalDeleted = deletedCars.length + deletedCustomers.length + deletedTransactions.length + deletedAppointments.length;

  const confirmAndDo = (msg, fn) => {
    if (window.confirm(msg)) fn();
  };

  const renderSection = (title, icon, items, type) => {
    if (items.length === 0) return null;
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`trash-section-${type}`}>
        <div className="p-4 border-b border-border flex items-center gap-3">
          {React.createElement(icon, { size: 20, className: 'text-muted-foreground' })}
          <div>
            <h3 className="font-heading font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{items.length} öğe</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {items.map(item => {
            if (type === 'car') {
              return <TrashItem key={item.id} icon={Car} title={`${item.brand} ${item.model}`}
                subtitle={`${item.plate?.toUpperCase() || ''} - ${formatCurrency(item.sale_price || 0)}`}
                deletedAt={item.deleted_at}
                onRestore={() => restoreCar(item.id)}
                onDelete={() => confirmAndDo('Bu aracı kalıcı olarak silmek istediğinize emin misiniz?', () => deleteCar(item.id, true))}
                testIdPrefix={`car-${item.id}`} />;
            }
            if (type === 'customer') {
              return <TrashItem key={item.id} icon={Users} title={item.name}
                subtitle={item.phone || '-'}
                deletedAt={item.deleted_at}
                onRestore={() => restoreCustomer(item.id)}
                onDelete={() => confirmAndDo('Bu müşteriyi kalıcı olarak silmek istediğinize emin misiniz?', () => deleteCustomer(item.id, true))}
                testIdPrefix={`customer-${item.id}`} />;
            }
            if (type === 'transaction') {
              return <TrashItem key={item.id} icon={CreditCard}
                title={`${item.type === 'income' ? 'Gelir' : 'Gider'}: ${item.category || ''}`}
                subtitle={`${formatCurrency(item.amount || 0)} - ${item.description || ''}`}
                deletedAt={item.deleted_at}
                onRestore={() => restoreTransaction(item.id)}
                onDelete={() => confirmAndDo('Bu işlemi kalıcı olarak silmek istediğinize emin misiniz?', () => deleteTransaction(item.id, true))}
                testIdPrefix={`tx-${item.id}`} />;
            }
            if (type === 'appointment') {
              return <TrashItem key={item.id} icon={Calendar}
                title={item.customer_name || 'Randevu'}
                subtitle={`${item.date || ''} ${item.time || ''} - ${item.notes || ''}`}
                deletedAt={item.deleted_at}
                onRestore={() => restoreAppointment(item.id)}
                onDelete={() => confirmAndDo('Bu randevuyu kalıcı olarak silmek istediğinize emin misiniz?', () => deleteAppointment(item.id, true))}
                testIdPrefix={`appt-${item.id}`} />;
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-24 md:pb-6 animate-fade-in" data-testid="trash-page">
      {/* Warning Banner */}
      <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-warning mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-warning text-sm">Çöp Kutusu ({totalDeleted})</p>
          <p className="text-xs text-muted-foreground">Silinen öğeler burada görünür. Kalıcı silme geri alınamaz.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1" data-testid="trash-tabs">
        {TABS.map(tab => {
          const count = tab.id === 'all' ? totalDeleted :
            tab.id === 'cars' ? deletedCars.length :
            tab.id === 'transactions' ? deletedTransactions.length :
            tab.id === 'customers' ? deletedCustomers.length :
            deletedAppointments.length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`trash-tab-${tab.id}`}
            >
              <tab.icon size={14} />
              {tab.label}
              {count > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-background/30 text-[10px]">{count}</span>}
            </button>
          );
        })}
      </div>

      {totalDeleted === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Trash2 size={32} className="text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold text-lg mb-2">Çöp Kutusu Boş</h3>
          <p className="text-muted-foreground text-sm">Silinen öğe bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(activeTab === 'all' || activeTab === 'cars') && renderSection('Silinen Araçlar', Car, deletedCars, 'car')}
          {(activeTab === 'all' || activeTab === 'transactions') && renderSection('Silinen İşlemler', CreditCard, deletedTransactions, 'transaction')}
          {(activeTab === 'all' || activeTab === 'customers') && renderSection('Silinen Müşteriler', Users, deletedCustomers, 'customer')}
          {(activeTab === 'all' || activeTab === 'appointments') && renderSection('Silinen Randevular', Calendar, deletedAppointments, 'appointment')}
        </div>
      )}
    </div>
  );
};

export default TrashPage;
