import React, { useState } from 'react';
import { ShoppingCart, MessageCircle, FileSignature } from 'lucide-react';
import { formatNumberInput, parseNumber, formatCurrency, formatPhoneInput, openPrintableHTML } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { usersAPI, fileAPI } from '../../services/api';
import { buildSalesContractHTML } from '../../utils/salesContract';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const SaleModal = ({ isOpen, onClose, car, onConfirmSale }) => {
  const { customers, addCustomer, user, transactions } = useApp();
  const [formData, setFormData] = useState({
    price: '',
    employee_share: '',
    employee_name: '',
    customer_id: '',
    sale_date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [employees, setEmployees] = useState([]);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState(null);

  React.useEffect(() => {
    if (car && isOpen) {
      setFormData({
        price: formatNumberInput(car.sale_price),
        employee_share: '',
        employee_name: '',
        customer_id: '',
        sale_date: new Date().toISOString().split('T')[0]
      });
      setShowEmployeeList(false);
      setSaleCompleted(false);
      setCompletedSaleData(null);
      // Fetch employees
      usersAPI.getEmployees().then(res => setEmployees(res.data || [])).catch(() => {});
    }
  }, [car, isOpen]);

  const activeCustomers = customers.filter(c => !c.deleted);

  const handleAddNewCustomer = async () => {
    if (!newCustomerName.trim()) return;
    
    try {
      const newCustomer = await addCustomer({
        name: newCustomerName,
        phone: newCustomerPhone,
        type: 'Satış Yapıldı',
        notes: `${car?.brand} ${car?.model} satışı`,
        interested_car_id: car?.id
      });
      
      setFormData(prev => ({ ...prev, customer_id: newCustomer.id }));
      setShowNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!car) return;
    if (car.status === 'Satıldı') {
      alert('Bu araç zaten satılmış!');
      return;
    }

    // Müşteri seçimi kontrolü
    if (!formData.customer_id) {
      alert('Lütfen bir müşteri seçin veya yeni müşteri ekleyin.');
      return;
    }

    setLoading(true);
    try {
      await onConfirmSale({
        carId: car.id,
        price: parseNumber(formData.price),
        employeeShare: parseNumber(formData.employee_share),
        employeeName: formData.employee_name,
        customerId: formData.customer_id,
        saleDate: formData.sale_date
      });
      
      // Satış tamamlandı - WhatsApp mesajı için bilgileri sakla
      const selectedCustomer = activeCustomers.find(c => c.id === formData.customer_id);
      setCompletedSaleData({
        customer: selectedCustomer,
        car: car,
        price: parseNumber(formData.price)
      });
      setSaleCompleted(true);
      
    } catch (error) {
      console.error('Error confirming sale:', error);
      // Hata mesajı parent (App.js) tarafından gösterildi; burada tekrar alert gösterme
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp mesajı gönder
  const handleSendWhatsApp = () => {
    if (!completedSaleData) return;
    
    const { customer, car: soldCar } = completedSaleData;
    
    // Güvenli şekilde company_name al
    const companyName = user?.company_name || 'ASLANBAŞ YAPI ENERJİ GIDA TARIM HAYVANCILIK A.Ş.';    
    // Mesaj şablonu
    const message = `Sayın ${customer?.name || 'Değerli Müşterimiz'},

${soldCar?.plate?.toUpperCase() || 'Aracınız'} plakalı aracınızı ${companyName} bünyesinden temin etmiş olmanızdan dolayı teşekkürlerimizi sunarız.

Satış sonrası süreçte de müşteri memnuniyeti önceliğimiz olup, aracınızla ilgili her türlü talep, görüş ve destek ihtiyacınızda tarafımızla iletişime geçebileceğinizi bilgilerinize arz ederiz.

Aracınızı iyi günlerde kullanmanızı temenni eder, güvenli ve konforlu sürüşler dileriz.

Saygılarımızla,
${companyName}`;

    // Telefon numarasını temizle (sadece rakamlar)
    const phone = customer?.phone?.replace(/\D/g, '') || '';
    
    if (!phone) {
      alert('Müşterinin telefon numarası kayıtlı değil.');
      return;
    }

    // Türkiye için: 0 ile başlıyorsa kaldır, 90 ekle
    let formattedPhone = phone;
    if (phone.startsWith('0')) {
      formattedPhone = '90' + phone.substring(1);
    } else if (!phone.startsWith('90')) {
      formattedPhone = '90' + phone;
    }

    // WhatsApp Web linki oluştur
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    // Yeni sekmede aç
    window.open(whatsappUrl, '_blank');
    
    // Modal'ı kapat
    setTimeout(() => {
      handleCloseModal();
    }, 500);
  };

  // Satış Sözleşmesi PDF (noter formatı) — yeni sekmede açıp yazdırır
  const handleGenerateContract = async () => {
    if (!completedSaleData) return;
    let logoDataUrl = null;
    try {
      const logoPath = user?.logo_url || '';
      if (logoPath) {
        const url = logoPath.startsWith('http') ? logoPath : fileAPI.getUrl(logoPath);
        logoDataUrl = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d').drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      }
    } catch { /* logo optional */ }

    const html = buildSalesContractHTML({
      car: completedSaleData.car,
      customer: completedSaleData.customer,
      salePrice: completedSaleData.price,
      saleDate: formData.sale_date,
      company: {
        company_name: user?.company_name || 'MACTech Oto Galeri',
        phone: user?.phone || '',
        address: user?.address || '',
        tax_no: user?.tax_no || user?.tax_number || '',
        logoDataUrl,
      },
    });
    openPrintableHTML(html);
  };

  const handleCloseModal = () => {
    setFormData({
      price: '',
      employee_share: '',
      employee_name: '',
      customer_id: '',
      sale_date: new Date().toISOString().split('T')[0]
    });
    setShowNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setSaleCompleted(false);
    setCompletedSaleData(null);
    onClose();
  };

  if (!car) return null;

  const isSold = car.status === 'Satıldı';
  const finalPrice = parseNumber(formData.price);
  const deposit = car.deposit_amount || 0;
  const remaining = finalPrice - deposit;
  const employeeShare = parseNumber(formData.employee_share);
  const ownerPayment = car.ownership === 'consignment' ? (car.purchase_price || 0) : 0;

  // ✅ Araca ait birikmiş giderleri (boya, bakım, lastik, sigorta, yedek parça vb.)
  // Alış maliyeti, çalışan payı, sahibine ödeme ayrı kalemlerde gösterildiği için hariç.
  const vehicleExpenses = (transactions || [])
    .filter(t => (
      t.car_id === car.id &&
      t.type === 'expense' &&
      !t.deleted &&
      t.category !== 'Araç Alımı' &&
      t.category !== 'Araç Sahibine Ödeme' &&
      t.category !== 'Çalışan Payı' &&
      t.category !== 'Kapora İadesi'
    ));
  const totalVehicleExpenses = vehicleExpenses.reduce((sum, t) => sum + (t.amount || 0), 0);

  const netProfit =
    remaining
    - employeeShare
    - ownerPayment
    - (car.ownership === 'stock' ? (car.purchase_price || 0) : 0)
    - totalVehicleExpenses;

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart size={24} className={saleCompleted ? "text-success" : "text-primary"} />
            {saleCompleted ? 'Satış Tamamlandı!' : 'Satış Onayla'}
          </DialogTitle>
        </DialogHeader>

        {saleCompleted ? (
          // Satış başarılı - WhatsApp mesajı ekranı
          <div className="space-y-6 py-4">
            <div className="bg-success/10 border border-success/30 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart size={32} className="text-success" />
              </div>
              <h3 className="text-xl font-semibold text-success mb-2">
                Satış Başarıyla Tamamlandı!
              </h3>
              <p className="text-muted-foreground">
                {car.plate?.toUpperCase()} plakalı araç başarıyla satıldı.
              </p>
            </div>

            {completedSaleData?.customer && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Satış Sonrası İşlemler</h4>
                <button
                  onClick={handleGenerateContract}
                  className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  data-testid="generate-sales-contract-btn"
                >
                  <FileSignature size={20} />
                  Satış Sözleşmesi PDF Oluştur
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  className="w-full h-12 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  data-testid="whatsapp-thankyou-btn"
                >
                  <MessageCircle size={20} />
                  WhatsApp ile Teşekkür Mesajı Gönder
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  {completedSaleData.customer.name} — {completedSaleData.car?.plate?.toUpperCase()}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 h-11 bg-muted hover:bg-muted/80 rounded-lg font-medium transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        ) : isSold ? (
          <div className="py-8 text-center">
            <p className="text-destructive font-semibold mb-2">Bu araç zaten satılmış!</p>
            <p className="text-sm text-muted-foreground">Satış kaydını geri almak için Gelir & Gider sayfasından iptal edin.</p>
          </div>
        ) : (
        <div className="mt-4">
          {/* Car Info */}
          <div className="p-4 bg-muted/50 rounded-lg mb-6">
            <p className="font-semibold">{car.brand} {car.model}</p>
            <p className="text-sm text-muted-foreground">{car.plate?.toUpperCase()}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Satış Fiyatı (₺)</label>
              <input
                type="text"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: formatNumberInput(e.target.value) }))}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                data-testid="sale-price-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Satış Tarihi</label>
              <input
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData(prev => ({ ...prev, sale_date: e.target.value }))}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                data-testid="sale-date-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Çalışan Payı (₺)</label>
              <input
                type="text"
                value={formData.employee_share}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_share: formatNumberInput(e.target.value) }))}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                placeholder="0"
                data-testid="employee-share-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Çalışan Seçimi</label>
              <button
                type="button"
                onClick={() => setShowEmployeeList(!showEmployeeList)}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg text-left flex items-center justify-between text-sm"
                data-testid="employee-select-btn"
              >
                <span className={formData.employee_name ? 'text-foreground' : 'text-muted-foreground'}>
                  {formData.employee_name || 'Çalışan seçilmedi'}
                </span>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showEmployeeList ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showEmployeeList && (
                <div className="mt-1 bg-card border border-border rounded-lg overflow-hidden shadow-lg" data-testid="employee-list">
                  <button
                    type="button"
                    onClick={() => { setFormData(prev => ({ ...prev, employee_name: '' })); setShowEmployeeList(false); }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-muted/60 transition-colors border-b border-border ${!formData.employee_name ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}
                  >
                    Çalışan seçilmedi
                  </button>
                  {employees.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => { setFormData(prev => ({ ...prev, employee_name: emp.name })); setShowEmployeeList(false); }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-muted/60 transition-colors border-b border-border last:border-0 ${formData.employee_name === emp.name ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                      data-testid={`employee-option-${emp.id}`}
                    >
                      {emp.name}
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({emp.role === 'admin' ? 'Admin' : emp.role === 'muhasebe' ? 'Muhasebe' : 'Satış'})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Müşteri</label>
              {!showNewCustomer ? (
                <div className="space-y-2">
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                    className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                    data-testid="sale-customer-select"
                  >
                    <option value="">Müşteri seçilmedi</option>
                    {activeCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    className="text-sm text-primary hover:underline"
                    data-testid="add-new-customer-btn"
                  >
                    + Yeni Müşteri Ekle
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="Müşteri adı"
                    data-testid="new-customer-name-input"
                  />
                  <input
                      type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(formatPhoneInput(e.target.value))}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="0532 XXX XX XX"
                    maxLength={14}
                    data-testid="new-customer-phone-input"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddNewCustomer}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                    >
                      Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(false)}
                      className="flex-1 py-2 border border-border rounded-lg text-sm"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Satış Fiyatı</span>
                <span className="font-medium">{formatCurrency(finalPrice)}</span>
              </div>
              {deposit > 0 && (
                <div className="flex justify-between text-warning">
                  <span>Alınan Kapora</span>
                  <span>-{formatCurrency(deposit)}</span>
                </div>
              )}
              {employeeShare > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Çalışan Payı</span>
                  <span>-{formatCurrency(employeeShare)}</span>
                </div>
              )}
              {ownerPayment > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Araç Sahibine</span>
                  <span>-{formatCurrency(ownerPayment)}</span>
                </div>
              )}
              {car.ownership === 'stock' && (car.purchase_price || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground" data-testid="summary-purchase-price">
                  <span>Alış Maliyeti</span>
                  <span>-{formatCurrency(car.purchase_price)}</span>
                </div>
              )}
              {totalVehicleExpenses > 0 && (
                <div className="flex flex-col gap-1" data-testid="summary-vehicle-expenses">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Araç Giderleri ({vehicleExpenses.length} kalem)</span>
                    <span>-{formatCurrency(totalVehicleExpenses)}</span>
                  </div>
                  <details className="text-xs text-muted-foreground/80 pl-3">
                    <summary className="cursor-pointer hover:text-primary transition-colors">
                      Detayları gör
                    </summary>
                    <ul className="mt-1.5 space-y-1">
                      {vehicleExpenses.map(t => (
                        <li key={t.id} className="flex justify-between">
                          <span>• {t.category || 'Gider'} {t.description ? `(${t.description.substring(0, 30)}${t.description.length > 30 ? '…' : ''})` : ''}</span>
                          <span>-{formatCurrency(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span>Tahmini Net Kar</span>
                <span className={netProfit >= 0 ? 'text-success' : 'text-destructive'}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 sm:px-6 py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-sm"
                data-testid="cancel-sale-btn"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 sm:px-6 py-3 rounded-lg bg-success text-success-foreground font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 text-sm"
                data-testid="confirm-sale-btn"
              >
                {loading ? 'İşleniyor...' : 'Satışı Onayla'}
              </button>
            </div>
          </form>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaleModal;
