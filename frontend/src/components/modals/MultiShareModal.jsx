import React from 'react';
import { Share2, Download, MessageCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/helpers';

/**
 * Çoklu Araç Paylaşımı (Stok Kataloğu)
 * - Seçilen tüm araçlar tek metinde liste halinde
 * - WhatsApp/SMS/E-posta için sade biçimlendirme (kalın, • bullet)
 */
const MultiShareModal = ({ isOpen, onClose, cars = [], onShared }) => {
  const { user } = useApp();

  const buildText = () => {
    const head = `*${user?.company_name || 'MACTech Galeri'} — Güncel Stok*\n`;
    const body = cars.map((c, idx) => {
      const lines = [
        `*${idx + 1}. ${c.brand || ''} ${c.model || ''}*${c.year ? ` (${c.year})` : ''}`,
        c.package_info ? `   Paket: ${c.package_info}` : null,
        [
          c.km !== undefined && c.km !== null ? `${Number(c.km).toLocaleString('tr-TR')} km` : null,
          c.fuel_type,
          c.gear,
          c.color,
        ].filter(Boolean).join(' · '),
        c.sale_price ? `   *Fiyat:* ${formatCurrency(c.sale_price)}` : null,
      ].filter(Boolean);
      return lines.join('\n');
    }).join('\n\n');
    const foot = [
      '',
      `_${cars.length} araç_`,
      user?.phone ? `İletişim: ${user.phone}` : null,
    ].filter(Boolean).join('\n');
    return `${head}\n${body}${foot}`;
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(buildText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
    onShared?.();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      alert('Stok kataloğu kopyalandı.');
      onShared?.();
    } catch (_) {
      alert('Kopyalanamadı.');
    }
  };

  const handleNativeShare = async () => {
    const text = buildText();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Stok Kataloğu', text });
        onShared?.();
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    handleWhatsApp();
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([buildText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stok-katalogu-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={22} className="text-primary" />
            Stok Kataloğu Paylaşımı ({cars.length} araç)
          </DialogTitle>
        </DialogHeader>

        <div className="my-3 max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-xs whitespace-pre-wrap font-mono" data-testid="multi-share-preview">
          {buildText()}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="h-12 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="multi-share-native-btn"
          >
            <Share2 size={18} /> Paylaş (WhatsApp / vs.)
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="h-12 rounded-lg border border-green-500/40 text-green-500 hover:bg-green-500/10 font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="multi-share-wa-btn"
          >
            <MessageCircle size={18} /> WhatsApp Web
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="multi-share-copy-btn"
          >
            <MessageCircle size={16} /> Metni Kopyala
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="multi-share-txt-btn"
          >
            <Download size={16} /> .txt İndir
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full h-10 rounded-lg text-muted-foreground hover:bg-muted text-sm flex items-center justify-center gap-2"
        >
          <X size={16} /> Kapat
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default MultiShareModal;
