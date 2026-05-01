import React, { useState } from 'react';
import { Mail, Send, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Haftalık özet e-maili paneli — manuel test & preview
const DigestPanel = () => {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const token = localStorage.getItem('crm_token');
  const headers = { Authorization: `Bearer ${token}` };

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
    } catch {
      toast.error('Önizleme alınamadı');
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid="digest-panel">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Mail size={18} className="text-primary" />
            Haftalık Özet E-Maili
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Her Pazartesi sabah 09:00'da (Türkiye saati) otomatik olarak kayıtlı admin e-postasına
            son 7 günün özetini gönderir. Aşağıdan manuel olarak test gönderebilir veya önizleyebilirsiniz.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handlePreview}
          className="h-10 px-4 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          data-testid="digest-preview-btn"
        >
          <Eye size={16} /> Önizleme
        </button>
        <button
          onClick={handleSendNow}
          disabled={sending}
          className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
          data-testid="digest-send-now-btn"
        >
          <Send size={16} /> {sending ? 'Gönderiliyor…' : 'Test Gönder'}
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
