import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Share2, Download, MessageCircle, X, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/helpers';
import { fileAPI } from '../../services/api';
import { buildSedanDiagramSvg } from './promoParts/sedanDiagram';

/**
 * Çoklu Araç Paylaşımı (Stok Kataloğu)
 *  - PDF: her araç ayrı bir A4 sayfa (foto + bilgiler + ekspertiz + fiyat)
 *  - WhatsApp Text: sade liste
 *  - .txt İndir
 */
const Spec = ({ label, value }) => (
  <div className="flex items-baseline gap-2 text-xs">
    <span className="text-white/50 tracking-wider uppercase text-[9px] font-semibold">{label}</span>
    <span className="text-white font-bold">{value}</span>
  </div>
);

/** Tek bir araç için kart node — html2canvas ile yakalanmak için gizli render edilir */
const CarPdfPage = React.forwardRef(({ car, user, logoUrl, photoUrl, expertiseParts, pageInfo }, ref) => (
  <div
    ref={ref}
    className="bg-[#0b0b0c] text-white flex flex-col"
    style={{
      width: 540,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}
  >
    {/* Üst foto */}
    <div className="relative w-full overflow-hidden" style={{ height: 260 }}>
      {photoUrl ? (
        <img src={photoUrl} alt={car.model} className="h-full w-full object-cover" crossOrigin="anonymous" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-500 text-sm">
          Fotoğraf yüklü değil
        </div>
      )}
      <div className="absolute inset-x-0 top-0 px-4 py-2.5 bg-gradient-to-b from-black/85 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {logoUrl && (
            <img src={logoUrl} alt="logo" crossOrigin="anonymous" className="h-7 w-7 object-contain rounded-sm" />
          )}
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary truncate">
            {user?.company_name || 'Oto-Cari Otomotiv'}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pageInfo && (
            <div className="px-2 py-0.5 rounded bg-white/15 text-white text-[10px] font-bold tracking-wider">
              {pageInfo}
            </div>
          )}
          {car.plate && (
            <div className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-extrabold tracking-wider">
              {(car.plate || '').toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0b0b0c] to-transparent" />
    </div>

    {/* İçerik */}
    <div className="px-5 pt-3 pb-5 space-y-3">
      <div>
        <div className="text-[24px] font-extrabold leading-tight tracking-tight">
          {car.brand} {car.model}
        </div>
        <div className="mt-0.5 text-xs text-white/70">
          {[car.year, car.package_info].filter(Boolean).join('  ·  ')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {car.km !== undefined && car.km !== null && <Spec label="KM" value={`${Number(car.km).toLocaleString('tr-TR')}`} />}
        {car.fuel_type && <Spec label="Yakıt" value={car.fuel_type} />}
        {car.gear && <Spec label="Vites" value={car.gear} />}
        {car.engine_type && <Spec label="Motor" value={car.engine_type} />}
        {car.color && <Spec label="Renk" value={car.color} />}
        {car.year && <Spec label="Model Yılı" value={String(car.year)} />}
      </div>

      {Object.keys(expertiseParts).length > 0 && (
        <div
          className="rounded-lg overflow-hidden border border-white/10 bg-black mx-auto"
          style={{ maxWidth: 320 }}
          dangerouslySetInnerHTML={{
            __html: buildSedanDiagramSvg(
              { parts: expertiseParts },
              { includeLegend: true, includeSummaryList: false, withWrapper: true, darkBg: true, maxWidth: 320 }
            )
          }}
        />
      )}

      {car.sale_price > 0 && (
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/55 font-semibold">Fiyat</span>
          <span className="text-2xl font-extrabold text-primary">{formatCurrency(car.sale_price)}</span>
        </div>
      )}

      {(user?.phone || user?.email) && (
        <div className="text-[10px] text-white/55 text-center pt-1">
          {[user?.phone, user?.email].filter(Boolean).join('  ·  ')}
        </div>
      )}
    </div>
  </div>
));
CarPdfPage.displayName = 'CarPdfPage';

const normalizePhotoUrl = (car) => {
  const photos = car.photos || car.images || [];
  const first = photos[0];
  let url = null;
  if (typeof first === 'string') url = first;
  else if (first?.url) url = first.url;
  else if (first?.data) url = first.data;
  if (url && !url.startsWith('http') && !url.startsWith('data:')) {
    url = fileAPI.getUrl(url);
  }
  return url;
};
const normalizeExpertise = (car) =>
  car.expertise?.parts || car.expertise_parts || car.expertiseParts || {};

const MultiShareModal = ({ isOpen, onClose, cars = [], onShared }) => {
  const { user } = useApp();
  const pageRefs = useRef([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const logoUrl = React.useMemo(() => {
    const logo = user?.company_logo || user?.logo;
    if (!logo) return null;
    if (logo.startsWith('http')) return logo;
    return fileAPI.getUrl(logo);
  }, [user]);

  const buildText = () => {
    const head = `*${user?.company_name || 'Oto-Cari Otomotiv'} — Güncel Stok*\n`;
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

  /** PDF'in ilk sayfasını kurumsal kapak olarak çiz */
  const addCoverPage = async (pdf) => {
    const pageW = 210, pageH = 297;

    // Tam karanlık arka plan
    pdf.setFillColor(11, 11, 12);
    pdf.rect(0, 0, pageW, pageH, 'F');

    // Üst gold şerit
    pdf.setFillColor(197, 162, 103);
    pdf.rect(0, 0, pageW, 3, 'F');

    // Galeri logosu (varsa) — merkez üst
    let titleY = 85;
    if (logoUrl) {
      try {
        const logoData = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
          };
          img.onerror = reject;
          setTimeout(reject, 3000);
          img.src = logoUrl;
        });
        const maxLogoW = 60;
        const maxLogoH = 60;
        const ratio = logoData.w / logoData.h;
        let lw = maxLogoW, lh = lw / ratio;
        if (lh > maxLogoH) { lh = maxLogoH; lw = lh * ratio; }
        const lx = (pageW - lw) / 2;
        pdf.addImage(logoData.data, 'PNG', lx, 50, lw, lh);
        titleY = 50 + lh + 18;
      } catch (e) {
        console.warn('Logo cover render failed', e);
      }
    }

    // Galeri adı
    const companyName = (user?.company_name || 'Oto-Cari Otomotiv').toUpperCase();
    pdf.setTextColor(197, 162, 103);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(companyName, pageW / 2, titleY, { align: 'center' });

    // Alt çizgi (gold)
    pdf.setDrawColor(197, 162, 103);
    pdf.setLineWidth(0.6);
    pdf.line(pageW / 2 - 30, titleY + 5, pageW / 2 + 30, titleY + 5);

    // Başlık: STOK KATALOĞU
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(34);
    pdf.text('STOK KATALOĞU', pageW / 2, titleY + 25, { align: 'center' });

    // Alt başlık: Ay Yıl
    const now = new Date();
    const months = ['OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN','TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK'];
    const monthYear = `${months[now.getMonth()]} ${now.getFullYear()}`;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(13);
    pdf.setTextColor(200, 200, 200);
    pdf.text(monthYear, pageW / 2, titleY + 36, { align: 'center' });

    // Araç sayısı kutusu (ortada)
    const boxY = pageH / 2 + 20;
    const boxW = 70;
    const boxH = 40;
    const boxX = (pageW - boxW) / 2;
    pdf.setDrawColor(197, 162, 103);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'S');

    pdf.setTextColor(197, 162, 103);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(46);
    pdf.text(String(cars.length), pageW / 2, boxY + 25, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(180, 180, 180);
    pdf.text('ARAÇ', pageW / 2, boxY + 35, { align: 'center' });

    // Alt iletişim bloğu
    const contactY = pageH - 50;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(197, 162, 103);
    pdf.text('İLETİŞİM', pageW / 2, contactY, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(240, 240, 240);
    let cy = contactY + 8;
    if (user?.phone) { pdf.text(user.phone, pageW / 2, cy, { align: 'center' }); cy += 6; }
    if (user?.email) { pdf.text(user.email, pageW / 2, cy, { align: 'center' }); cy += 6; }
    if (user?.address) {
      pdf.setFontSize(9);
      pdf.setTextColor(180, 180, 180);
      pdf.text(user.address, pageW / 2, cy, { align: 'center', maxWidth: pageW - 40 });
    }

    // Footer
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text('Powered by MacTech', pageW / 2, pageH - 10, { align: 'center' });

    // Alt gold şerit
    pdf.setFillColor(197, 162, 103);
    pdf.rect(0, pageH - 3, pageW, 3, 'F');
  };

  /** Tüm sayfaları capture edip A4 pdf üret */
  const buildCatalogPdf = async () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 12;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;

    // ✨ İlk sayfa: Kapak
    await addCoverPage(pdf);

    setProgress({ current: 0, total: cars.length });
    for (let i = 0; i < cars.length; i += 1) {
      const el = pageRefs.current[i];
      if (!el) continue;
      // Görsellerin yüklenmesini bekle
      const imgs = el.querySelectorAll('img');
      await Promise.all(Array.from(imgs).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((res) => {
          img.onload = res;
          img.onerror = res;
          setTimeout(res, 2500); // safety timeout
        });
      }));

      const canvas = await html2canvas(el, {
        backgroundColor: '#0b0b0c',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);

      // Kapaktan sonra her araç yeni sayfada
      pdf.addPage();
      pdf.setFillColor(11, 11, 12);
      pdf.rect(0, 0, pageW, pageH, 'F');

      const companyName = (user?.company_name || 'Oto-Cari Otomotiv').toUpperCase();
      pdf.setTextColor(197, 162, 103);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(companyName, pageW / 2, 9, { align: 'center' });

      // Kart oranını koruyarak içeri sığdır
      const ratio = canvas.width / canvas.height;
      let w = availW;
      let h = w / ratio;
      if (h > availH) { h = availH; w = h * ratio; }
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(imgData, 'JPEG', x, y, w, h, undefined, 'FAST');

      const contact = [user?.phone, user?.email].filter(Boolean).join('  ·  ');
      pdf.setTextColor(180, 180, 180);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      if (contact) pdf.text(contact, pageW / 2, pageH - 8, { align: 'center' });
      pdf.setTextColor(140, 140, 140);
      pdf.setFontSize(7);
      pdf.text(`Sayfa ${i + 1} / ${cars.length}  ·  Powered by MacTech`, pageW / 2, pageH - 4, { align: 'center' });

      setProgress({ current: i + 1, total: cars.length });
    }
    return pdf;
  };

  const handleDownloadPDF = async () => {
    if (cars.length === 0) return toast.error('Araç yok');
    setGenerating(true);
    try {
      const pdf = await buildCatalogPdf();
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`stok-katalogu-${date}.pdf`);
      toast.success(`${cars.length} araçlık katalog indirildi`);
      onShared?.();
    } catch (e) {
      console.error('Catalog PDF error:', e);
      toast.error('PDF oluşturulamadı');
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleSharePDF = async () => {
    if (cars.length === 0) return toast.error('Araç yok');
    setGenerating(true);
    try {
      const pdf = await buildCatalogPdf();
      const blob = pdf.output('blob');
      const date = new Date().toISOString().split('T')[0];
      const filename = `stok-katalogu-${date}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Stok Kataloğu', text: buildText() });
          onShared?.();
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      // Fallback: indir + wa.me
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank');
      }, 600);
      onShared?.();
    } catch (e) {
      console.error(e);
      toast.error('PDF paylaşılamadı');
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(buildText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
    onShared?.();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      toast.success('Stok kataloğu kopyalandı.');
      onShared?.();
    } catch (_) {
      toast.error('Kopyalanamadı.');
    }
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
    <>
      {/* Gizli render alanı — html2canvas burada her aracı yakalar */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        {cars.map((car, idx) => (
          <CarPdfPage
            key={car.id || idx}
            ref={(el) => { pageRefs.current[idx] = el; }}
            car={car}
            user={user}
            logoUrl={logoUrl}
            photoUrl={normalizePhotoUrl(car)}
            expertiseParts={normalizeExpertise(car)}
            pageInfo={`${idx + 1}/${cars.length}`}
          />
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="multi-share-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 size={22} className="text-primary" />
              Stok Kataloğu Paylaşımı ({cars.length} araç)
            </DialogTitle>
          </DialogHeader>

          {/* PDF aksiyonları — vurgulu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={handleSharePDF}
              disabled={generating || cars.length === 0}
              className="h-12 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              data-testid="multi-share-pdf-share-btn"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              {generating ? `Hazırlanıyor ${progress.current}/${progress.total}` : 'PDF Olarak Paylaş'}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={generating || cars.length === 0}
              className="h-12 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              data-testid="multi-share-pdf-download-btn"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {generating ? `${progress.current}/${progress.total}` : 'PDF İndir (Katalog)'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Her araç ayrı bir A4 sayfa olarak hazırlanır: galeri logosu, araç fotoğrafı, teknik bilgiler, ekspertiz şeması ve fiyat.
          </p>

          <div className="my-3 max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-xs whitespace-pre-wrap font-mono" data-testid="multi-share-preview">
            {buildText()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="h-11 rounded-lg border border-green-500/40 text-green-500 hover:bg-green-500/10 font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
              data-testid="multi-share-wa-btn"
            >
              <MessageCircle size={16} /> WhatsApp (Metin)
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
              className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 transition-colors sm:col-span-2"
              data-testid="multi-share-txt-btn"
            >
              <Download size={16} /> .txt İndir
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="mt-2 w-full h-10 rounded-lg text-muted-foreground hover:bg-muted text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <X size={16} /> Kapat
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MultiShareModal;
