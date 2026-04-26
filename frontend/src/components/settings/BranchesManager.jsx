import React, { useEffect, useState } from 'react';
import { branchesAPI } from '../../services/api';
import { Building2, Plus, Trash2, Star, Pencil, Check, X as XIcon, Loader2 } from 'lucide-react';

const empty = { name: '', city: '', address: '', phone: '', is_main: false };

const BranchesManager = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await branchesAPI.list();
      setItems(res.data || []);
    } catch (e) {
      setError('Şubeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (b) => {
    setEditingId(b.id);
    setDraft({
      name: b.name || '',
      city: b.city || '',
      address: b.address || '',
      phone: b.phone || '',
      is_main: !!b.is_main,
    });
    setShowAdd(false);
    setError('');
  };

  const startAdd = () => {
    setDraft({ ...empty, is_main: items.length === 0 });
    setEditingId(null);
    setShowAdd(true);
    setError('');
  };

  const cancel = () => {
    setEditingId(null);
    setShowAdd(false);
    setDraft(empty);
    setError('');
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Şube adı zorunludur');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await branchesAPI.update(editingId, draft);
      } else {
        await branchesAPI.create(draft);
      }
      await load();
      cancel();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`"${b.name}" şubesini silmek istediğinize emin misiniz?`)) return;
    setBusy(true);
    setError('');
    try {
      await branchesAPI.delete(b.id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Silinemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5" data-testid="branches-manager">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-primary" />
          <h3 className="font-semibold">Şubeler / Çoklu Galeri</h3>
        </div>
        {!showAdd && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            data-testid="add-branch-btn"
          >
            <Plus size={15} /> Şube Ekle
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Birden fazla galeri/şubeniz varsa buradan yönetin. Ana şube raporlarda öne çıkar.
      </p>

      {error && (
        <div className="p-3 mb-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="branches-error">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {(showAdd || editingId) && (
        <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3" data-testid="branch-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Şube Adı *</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Örn: Merkez Şube"
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                data-testid="branch-name-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Şehir</label>
              <input
                type="text"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                placeholder="Örn: İstanbul"
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                data-testid="branch-city-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Adres</label>
              <input
                type="text"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder="Açık adres"
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                data-testid="branch-address-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Telefon</label>
              <input
                type="text"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="0xxx xxx xx xx"
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                data-testid="branch-phone-input"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="branch-is-main"
                type="checkbox"
                checked={draft.is_main}
                onChange={(e) => setDraft({ ...draft, is_main: e.target.checked })}
                className="w-4 h-4 accent-primary"
                data-testid="branch-is-main-checkbox"
              />
              <label htmlFor="branch-is-main" className="text-sm cursor-pointer flex items-center gap-1">
                <Star size={14} className="text-amber-500" /> Ana şube olarak işaretle
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50"
              data-testid="branch-cancel-btn"
            >
              <XIcon size={14} /> İptal
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="branch-save-btn"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kaydet
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground" data-testid="branches-empty">
          Henüz şube eklenmemiş. İlk galerinizi/şubenizi ekleyin.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background/40"
              data-testid={`branch-row-${b.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{b.name}</span>
                  {b.is_main && (
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                      <Star size={10} /> Ana
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[b.city, b.address, b.phone].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition-colors"
                  data-testid={`edit-branch-${b.id}`}
                  title="Düzenle"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(b)}
                  className="w-8 h-8 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                  data-testid={`delete-branch-${b.id}`}
                  title="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchesManager;
