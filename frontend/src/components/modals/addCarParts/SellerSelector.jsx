import React, { useState } from 'react';
import { formatPhoneInput } from '../../../utils/helpers';

// ✅ Satıcı seçici — mevcut müşteri listesinden seç veya yeni satıcı ekle
const SellerSelector = ({ customers, selectedId, onChange, addCustomer }) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch] = useState('');
  const [newSeller, setNewSeller] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sadece silinmemiş müşteriler — Satıcı + Potansiyel + Aktif görünür
  const filtered = (customers || [])
    .filter((c) => !c.deleted)
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Satıcı tipindekiler en üstte
      const ar = a.type === 'Satıcı' ? 0 : 1;
      const br = b.type === 'Satıcı' ? 0 : 1;
      if (ar !== br) return ar - br;
      return (a.name || '').localeCompare(b.name || '', 'tr');
    });

  const selected = customers.find((c) => c.id === selectedId);

  const handleCreate = async () => {
    setError('');
    const name = (newSeller.name || '').trim();
    const phone = (newSeller.phone || '').replace(/\D/g, '');
    if (!name) return setError('İsim gerekli');
    if (!phone || phone.length !== 11) return setError('Telefon 11 haneli olmalı (örn 05321234567)');
    setSaving(true);
    try {
      const created = await addCustomer({ name, phone, type: 'Satıcı', notes: 'Araç alımı sırasında oluşturuldu' });
      if (created?.id) {
        onChange(created.id);
        setShowNewForm(false);
        setNewSeller({ name: '', phone: '' });
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Müşteri oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-amber-500/5 border border-amber-500/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-amber-600">Aracı Aldığımız Kişi (Satıcı)</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Müşteri listesinden seçin veya yeni satıcı ekleyin</p>
        </div>
        {!showNewForm && (
          <button
            type="button"
            onClick={() => { setShowNewForm(true); setError(''); }}
            className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 rounded-lg flex items-center gap-1.5"
            data-testid="seller-add-new-btn"
          >
            + Yeni Satıcı
          </button>
        )}
      </div>

      {showNewForm ? (
        <div className="space-y-2 p-3 bg-background border border-border rounded-lg">
          <input
            type="text"
            value={newSeller.name}
            onChange={(e) => setNewSeller({ ...newSeller, name: e.target.value })}
            placeholder="Satıcı Adı *"
            className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:border-amber-500 outline-none"
            data-testid="seller-new-name"
          />
          <input
            type="tel"
            value={newSeller.phone}
            onChange={(e) => setNewSeller({ ...newSeller, phone: formatPhoneInput(e.target.value) })}
            placeholder="Telefon (11 hane) *"
            maxLength={14}
            className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:border-amber-500 outline-none"
            data-testid="seller-new-phone"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              data-testid="seller-new-save"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet & Seç'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewForm(false); setNewSeller({ name: '', phone: '' }); setError(''); }}
              className="flex-1 h-9 border border-border rounded-lg text-sm"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara: isim veya telefon"
            className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:border-amber-500 outline-none"
            data-testid="seller-search"
          />
          <select
            value={selectedId || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:border-amber-500 outline-none"
            data-testid="seller-select"
          >
            <option value="">— Satıcı seçilmedi —</option>
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''} {c.type === 'Satıcı' ? '· Satıcı' : ''}
              </option>
            ))}
          </select>
          {selected && (
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg border border-amber-500/20 text-xs">
              <div>
                <span className="font-semibold">{selected.name}</span>
                {selected.phone && <span className="text-muted-foreground"> · {selected.phone}</span>}
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-destructive hover:underline"
                data-testid="seller-clear"
              >
                Kaldır
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SellerSelector;
