import React, { useState, useEffect } from 'react';
import { Mail, Send, Eye, CheckCircle2, AlertCircle, Clock, Save } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const DAYS = [
  { val: 'mon', label: 'Pazartesi' },
  { val: 'tue', label: 'Salı' },
  { val: 'wed', label: 'Çarşamba' },
  { val: 'thu', label: 'Perşembe' },
  { val: 'fri', label: 'Cuma' },
  { val: 'sat', label: 'Cumartesi' },
  { val: 'sun', label: 'Pazar' },
];

const DigestPanel = () => {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settings, setSettings] = useState({ enabled: true, day: 'mon', hour: 9, recipient: '', timezone: 'Europe/Istanbul' });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('crm_token');
  const headers = { Authorization: `Bearer ${token}` };

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/api/digest/settings`, { headers });
      setSettings(res.data);
    } catch { /* ignore */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadSettings(); }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/digest/settings`, {
        enabled: settings.enabled,
        day: settings.day,
        hour: Number(settings.hour),
      }, { headers });
      toast.success('Zamanlama ayarları kaydedildi');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!window.confirm('Haftalık özet maili şimdi kayıtlı e-posta adresinize gönderilsin mi?')) return;
    setSending(true);
    setLastResult(null);
    try {
      const res = await axios.post(`${API}/api/digest/send-now`, {}, { headers });
      setLastResult(res.data);
      if (res.data?.sent) {
        toast.success(`E-posta gönderildi: ${res.data.recipient}`);
      } else {
        toast.error(`Gönderilemedi: ${res.data?.error || 'Bilinmeyen hata'}`);
      }
    } catch (e) {
      const msg = e.response?.data?.detail || 'Gönderim başarısız';
      toast.error(msg);
      setLastResult({ sent: false, error: msg });
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    try {
      const res = await axios.get(`${API}/api/digest/preview`, { headers });
      setPreviewHtml(res.data?.html || '');
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Önizleme alınamadı');
    }
  };

  const dayLabel = DAYS.find(d => d.val === settings.day)?.label || settings.day;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5" data-testid="digest-panel">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Mail size={18} className="text-primary" />
          Haftalık Özet E-Maili
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Otomatik olarak <strong>{dayLabel} saat {String(settings.hour).padStart(2, '0')}:00</strong> ({settings.timezone}) da {settings.recipient || '—'} adresine son 7 günün özetini gönderir.
        </p>
      </div>

      {/* Zamanlama Ayarları */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
        <label className="flex items-center gap-2 text-sm cursor-pointer col-span-1 sm:col-span-4">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings(s => ({ ...s, enabled: e.target.checked }))}
            className="w-4 h-4 accent-primary"
            data-testid="digest-enabled-toggle"
          />
          <span className="font-medium">
            Otomatik haftalık özet gönderimi {settings.enabled ? 'açık' : 'kapalı'}
          </span>
        </label>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider">Gün</label>
          <select
            value={settings.day}
            onChange={(e) => setSettings(s => ({ ...s, day: e.target.value }))}
            disabled={!settings.enabled}
            className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm disabled:opacity-50"
            data-testid="digest-day-select"
          >
            {DAYS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider">Saat</label>
          <select
            value={settings.hour}
            onChange={(e) => setSettings(s => ({ ...s, hour: Number(e.target.value) }))}
            disabled={!settings.enabled}
            className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm disabled:opacity-50"
            data-testid="digest-hour-select"
          >
            {Array.from({ length: 24 }, (_, i) => i).map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 flex items-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="h-9 w-full sm:w-auto px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
            data-testid="digest-save-settings-btn"
          >
            <Save size={14} /> {saving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Clock size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Manuel test:</span>
        <button
          onClick={handlePreview}
          className="h-9 px-3 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          data-testid="digest-preview-btn"
        >
          <Eye size={14} /> Önizleme
        </button>
        <button
          onClick={handleSendNow}
          disabled={sending}
          className="h-9 px-3 bg-success/90 hover:bg-success text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
          data-testid="digest-send-now-btn"
        >
          <Send size={14} /> {sending ? 'Gönderiliyor…' : 'Şimdi Gönder'}
        </button>
      </div>

      {lastResult && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${
            lastResult.sent
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
          data-testid="digest-result"
        >
          {lastResult.sent ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <div className="min-w-0">
            {lastResult.sent ? (
              <>
                <div className="font-semibold">Gönderildi</div>
                <div className="text-xs opacity-80 break-all">
                  Alıcı: {lastResult.recipient} • ID: {lastResult.email_id || '-'}
                </div>
                {lastResult.stats && (
                  <div className="text-xs opacity-80 mt-1">
                    Son 7 gün: {lastResult.stats.sold_count} araç satıldı • {lastResult.stats.new_car_count} yeni araç •{' '}
                    {lastResult.stats.price_change_count} fiyat değişikliği
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-semibold">Gönderilemedi</div>
                <div className="text-xs opacity-80 break-all">{lastResult.error}</div>
              </>
            )}
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-semibold text-black">E-Mail Önizleme</h4>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-800 text-xl"
                data-testid="digest-preview-close"
              >
                ×
              </button>
            </div>
            <iframe
              title="Digest Preview"
              srcDoc={previewHtml}
              className="flex-1 w-full border-0"
              data-testid="digest-preview-iframe"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DigestPanel;
