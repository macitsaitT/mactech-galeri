import React, { useState, useRef } from 'react';
import { ScanLine, Loader2 } from 'lucide-react';
import { ocrAPI } from '../../services/api';
import { toast } from 'sonner';

// ✅ OCR Tarama Butonu — Ruhsat veya Kimlik fotoğrafını yükler,
// Gemini Vision ile alanları çıkarır, parent'a `onExtract(data)` callback ile iletir.
// Kullanım:
//   <OCRScanButton type="ruhsat" onExtract={(data) => { setFormData({...formData, ...mapRuhsat(data)}) }} />
const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/webp';

export const OCRScanButton = ({ type, onExtract, label, className = '' }) => {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const defaultLabel = type === 'ruhsat' ? 'Ruhsat Tara' : 'Kimlik Tara';

  const handlePick = () => {
    if (loading) return;
    inputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // aynı dosyayı tekrar yüklemeye izin ver
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Sadece JPG, PNG veya WebP yükleyin');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya çok büyük (max 10 MB)');
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`${type === 'ruhsat' ? 'Ruhsat' : 'Kimlik'} taranıyor…`);
    try {
      const { data } = await ocrAPI.extract(file, type);
      const result = data?.data || {};
      const filledCount = Object.values(result).filter(v => v && String(v).trim()).length;
      if (filledCount === 0) {
        toast.error('Görselden bilgi okunamadı. Daha net bir fotoğraf deneyin.', { id: toastId });
      } else {
        toast.success(`${filledCount} alan otomatik dolduruldu`, { id: toastId });
        onExtract?.(result);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'OCR başarısız';
      toast.error(`OCR hatası: ${msg}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleFile}
        className="hidden"
        data-testid={`ocr-input-${type}`}
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={loading}
        className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        data-testid={`ocr-btn-${type}`}
        title={`Fotoğraftan otomatik doldur — ${type === 'ruhsat' ? 'ruhsat / araç tescil belgesi' : 'TC kimlik kartı / sürücü belgesi'}`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
        {loading ? 'Taranıyor…' : (label || defaultLabel)}
      </button>
    </>
  );
};

export default OCRScanButton;
