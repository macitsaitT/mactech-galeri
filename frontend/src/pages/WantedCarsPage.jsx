import React, { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Eye, Car, Phone, RefreshCcw } from 'lucide-react';
import { wantedCarsAPI, customersAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

const WantedCarsPage = () => {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [matchesModal, setMatchesModal] = useState(null); // { wanted_car, matches }
  const [form, setForm] = useState({
    customer_id: '', brand: '', model: '', year_min: '', year_max: '',
    budget_min: '', budget_max: '', fuel_type: '', gear: '', notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await wantedCarsAPI.list();
      setItems(res.data || []);
    } catch {
      toast.error('Talep listesi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    customersAPI.getAll().then(r => setCustomers((r.data || []).filter(c => !c.deleted))).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Müşteri seçin');
    try {
      await wantedCarsAPI.create({
        ...form,
        year_min: form.year_min ? Number(form.year_min) : null,
        year_max: form.year_max ? Number(form.year_max) : null,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      });
      toast.success('Talep eklendi');
      setAddOpen(false);
      setForm({ customer_id: '', brand: '', model: '', year_min: '', year_max: '', budget_min: '', budget_max: '', fuel_type: '', gear: '', notes: '' });
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.detail || 'Eklenemedi');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu talep silinsin mi?')) return;
    try {
      await wantedCarsAPI.delete(id);
      toast.success('Silindi');
      load();
    } catch {
      toast.error('Silinemedi');
    }
  };

  const handleShowMatches = async (wid) => {
    try {
      const res = await wantedCarsAPI.matches(wid);
      setMatchesModal(res.data);
    } catch {
      toast.error('Eşleşmeler alınamadı');
    }
  };

  return (
    <div className="space-y-4" data-testid="wanted-cars-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Search size={22} className="text-primary" />
            Aranan Araçlar
          </h2>
          <p className="text-sm text-muted-foreground">
            Stokta olmayan araçlar için müşteri talepleri — yeni araç eklendiğinde otomatik eşleşir.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2"
            data-testid="wanted-refresh-btn">
            <RefreshCcw size={16} /> Yenile
          </button>
          <button onClick={() => setAddOpen(true)}
            className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2"
            data-testid="wanted-add-btn">
            <Plus size={16} /> Yeni Talep
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Henüz talep yok. "Yeni Talep" ile başlayın.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]" data-testid="wanted-table">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                  <th className="text-left p-3">Müşteri</th>
                  <th className="text-left p-3">Aranan Araç</th>
                  <th className="text-left p-3">Yıl</th>
                  <th className="text-right p-3">Bütçe</th>
                  <th className="text-center p-3">Eşleşme</th>
                  <th className="text-left p-3">Notlar</th>
                  <th className="text-right p-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-b border-border hover:bg-muted/20" data-testid={`wanted-row-${it.id}`}>
                    <td className="p-3 text-sm">
                      <div className="font-semibold">{it.customer_name}</div>
                      {it.customer_phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone size={10} /> {it.customer_phone}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="font-medium">{it.brand || '-'} {it.model}</div>
                      {(it.fuel_type || it.gear) && (
                        <div className="text-xs text-muted-foreground">{[it.fuel_type, it.gear].filter(Boolean).join(' • ')}</div>
                      )}
                    </td>
                    <td className="p-3 text-sm tabular-nums">
                      {it.year_min || '-'} — {it.year_max || '-'}
                    </td>
                    <td className="p-3 text-sm text-right tabular-nums">
                      {it.budget_min || it.budget_max ? (
                        <>
                          <div>{formatCurrency(it.budget_min || 0)}</div>
                          <div className="text-xs text-muted-foreground">—{formatCurrency(it.budget_max || 0)}</div>
                        </>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      {it.match_count > 0 ? (
                        <button
                          onClick={() => handleShowMatches(it.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success/20 text-success font-bold text-xs hover:bg-success/30"
                          data-testid={`wanted-matches-${it.id}`}
                        >
                          <Car size={12} /> {it.match_count} araç
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{it.notes || '-'}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleShowMatches(it.id)} className="p-2 text-muted-foreground hover:text-primary" title="Eşleşmeleri gör">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDelete(it.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Sil">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Talep Ekle</DialogTitle>
            <DialogDescription>Müşterinin aradığı araç kriterlerini girin — eşleşen stok otomatik hesaplanır.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground mb-1 block">Müşteri *</label>
              <select required value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
                data-testid="wanted-form-customer">
                <option value="">-- Seçin --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone && `(${c.phone})`}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Marka</label>
                <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  placeholder="Ford" className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Model</label>
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Focus" className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Min Yıl</label>
                <input type="number" value={form.year_min} onChange={e => setForm(f => ({ ...f, year_min: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Max Yıl</label>
                <input type="number" value={form.year_max} onChange={e => setForm(f => ({ ...f, year_max: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Min Bütçe (₺)</label>
                <input type="number" value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Max Bütçe (₺)</label>
                <input type="number" value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Yakıt</label>
                <select value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm">
                  <option value="">—</option>
                  <option>Benzin</option><option>Dizel</option><option>LPG</option><option>Hibrit</option><option>Elektrikli</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block">Vites</label>
                <select value={form.gear} onChange={e => setForm(f => ({ ...f, gear: e.target.value }))}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm">
                  <option value="">—</option>
                  <option>Manuel</option><option>Otomatik</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground mb-1 block">Notlar</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAddOpen(false)} className="h-10 px-4 border border-border rounded-lg text-sm">İptal</button>
              <button type="submit" className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
                data-testid="wanted-form-submit">Ekle</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Matches Modal */}
      <Dialog open={!!matchesModal} onOpenChange={(open) => !open && setMatchesModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Eşleşen Araçlar
              {matchesModal && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {matchesModal.wanted_car?.customer_name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>Kriterlere uyan stoktaki aktif araçlar.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {matchesModal?.matches?.length === 0 ? (
              <p className="text-center p-6 text-muted-foreground text-sm">Kriterlere uyan stokta araç yok.</p>
            ) : (
              <ul className="divide-y divide-border">
                {matchesModal?.matches?.map(c => (
                  <li key={c.id} className="p-3" data-testid={`match-car-${c.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{c.brand} {c.model}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.plate?.toUpperCase()} • {c.year} • {c.km} km • {c.fuel_type || '-'} • {c.gear || '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-success">{formatCurrency(c.sale_price)}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{c.status}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WantedCarsPage;
