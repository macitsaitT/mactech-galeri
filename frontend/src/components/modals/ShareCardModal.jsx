import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, MessageCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatCurrency } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';

/**
 * WhatsApp Paylaşım Kartı - araç fotoğrafı + temel özelliklerden zarif bir görsel kart üretir.
 * - "Görseli İndir" → JPG indirir.
 * - "WhatsApp'ta Paylaş" → görseli indirir + wa.me'yi metinle açar (kullanıcı görseli ekler).
 */
const ShareCardModal = ({ isOpen, onClose, car }) => {
  const cardRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const { user } = useApp();
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!isOpen || !car) return;
    // İlk fotoğrafı al — base64 veya dış URL olabilir
    const photos = car.photos || car.images || [];
    const first = photos[0];
    if (typeof first === 'string') {
      setPhotoUrl(first);
    } else if (first?.url) {
      setPhotoUrl(first.url);
    } else if (first?.data) {
      setPhotoUrl(first.data);
    } else {
      setPhotoUrl(null);
    }
  }, [isOpen, car]);

  const generateImage = async () => {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0b0b0c',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      console.error('Image generation error:', e);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return alert('Görsel oluşturulamadı.');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(car.plate || car.id || 'arac').toString().replace(/\s+/g, '_')}-paylasim.jpg`;
    a.click();
  };

  const buildText = () => {
    const lines = [
      `${(car.brand || '')} ${(car.model || '')} ${(car.year || '')}`.trim(),
      car.package_info ? `📦 ${car.package_info}` : null,
      car.engine_type ? `⚙️ ${car.engine_type}` : null,
      car.gear ? `🔁 ${car.gear}` : null,
      car.fuel_type ? `⛽ ${car.fuel_type}` : null,
      typeof car.km !== 'undefined' && car.km !== null ? `📍 ${Number(car.km).toLocaleString('tr-TR')} km` : null,
      car.color ? `🎨 ${car.color}` : null,
      car.sale_price ? `💰 ${formatCurrency(car.sale_price)}` : null,
      '',
      `${user?.company_name || 'MACTech Galeri'}`,
      user?.phone ? `📞 ${user.phone}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleWhatsApp = async () => {
    // Önce görseli kullanıcıya indirt, sonra WhatsApp metni aç
    await handleDownload();
    const text = encodeURIComponent(buildText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'arac.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${car.brand} ${car.model}`, text: buildText() });
      } else {
        // Fallback: indir
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'arac-paylasim.jpg';
        a.click();
      }
    } catch (e) {
      console.error('share failed', e);
    }
  };

  if (!car) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={22} className="text-primary" />
            Paylaşım Kartı
          </DialogTitle>
        </DialogHeader>

        {/* Card preview - html2canvas ile JPG'ye çevrilecek */}
        <div className="my-3 overflow-hidden rounded-xl border border-border">
          <div
            ref={cardRef}
            className="relative w-full bg-[#0b0b0c] text-white"
            style={{ aspectRatio: '4 / 5', maxWidth: 540 }}
          >
            {/* Üst foto */}
            <div className="relative h-[55%] w-full overflow-hidden">
              {photoUrl ? (
                <img src={photoUrl} alt={car.model} className="h-full w-full object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-500 text-sm">
                  Fotoğraf yüklü değil
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 to-transparent" />
              {/* Plaka badge */}
              {car.plate && (
                <div className="absolute left-3 top-3 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-bold tracking-wider">
                  {(car.plate || '').toUpperCase()}
                </div>
              )}
            </div>

            {/* Alt detay */}
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 space-y-2.5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">{user?.company_name || 'MACTech Galeri'}</div>
                <div className="mt-0.5 text-2xl font-extrabold leading-tight">
                  {car.brand} {car.model}
                </div>
                <div className="text-xs text-white/70">
                  {[car.year, car.package_info].filter(Boolean).join(' · ')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/85">
                {car.km !== undefined && car.km !== null && (
                  <span>📍 {Number(car.km).toLocaleString('tr-TR')} km</span>
                )}
                {car.fuel_type && <span>⛽ {car.fuel_type}</span>}
                {car.gear && <span>🔁 {car.gear}</span>}
                {car.engine_type && <span>⚙️ {car.engine_type}</span>}
                {car.color && <span>🎨 {car.color}</span>}
              </div>

              {car.sale_price > 0 && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-white/60">Fiyat</span>
                  <span className="text-xl font-extrabold text-primary">{formatCurrency(car.sale_price)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={generating}
            className="w-full h-11 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            data-testid="share-card-whatsapp-btn"
          >
            <MessageCircle size={18} />
            WhatsApp'ta Paylaş (görseli indir + metin)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={generating}
              className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              data-testid="share-card-download-btn"
            >
              <Download size={16} />
              {generating ? 'Hazırlanıyor...' : 'Görseli İndir'}
            </button>
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={generating}
              className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              data-testid="share-card-native-btn"
            >
              <Share2 size={16} /> Cihazla Paylaş
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-lg text-muted-foreground hover:bg-muted text-sm flex items-center justify-center gap-2"
          >
            <X size={16} /> Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareCardModal;
