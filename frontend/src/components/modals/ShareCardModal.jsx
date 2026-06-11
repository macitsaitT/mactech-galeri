import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Share2, Download, MessageCircle, X, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { formatCurrency } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { buildSedanDiagramSvg } from './promoParts/sedanDiagram';
import { toast } from 'sonner';

// ✅ Sosyal medya şablon önayarları — kullanıcı format seçer.
//  - story_9_16: Instagram Story / WhatsApp Status (1080×1920)
//  - square_1_1: Instagram Post / Twitter Card (1080×1080)
//  - classic: Mevcut bilgi yoğun kart (1080×1458)
const FORMAT_PRESETS = {
  classic:    { id: 'classic',    label: 'Klasik',         ratio: '1080 / 1458', maxWidth: 540, layout: 'classic'  },
  story_9_16: { id: 'story_9_16', label: 'Story 9:16',     ratio: '1080 / 1920', maxWidth: 380, layout: 'story'    },
  square_1_1: { id: 'square_1_1', label: 'Kare 1:1',       ratio: '1080 / 1080', maxWidth: 540, layout: 'square'   },
};

/**
 * WhatsApp Paylaşım Kartı - araç fotoğrafı + temel özelliklerden zarif bir görsel kart üretir.
 * - "Görseli İndir" → PNG indirir.
 * - "Paylaş" → native Web Share API (mobil) ile sosyal medyaya iletilir.
 */
const ShareCardModal = ({ isOpen, onClose, car }) => {
  const cardRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const { user } = useApp();
  const [photoUrl, setPhotoUrl] = useState(null);
  const [format, setFormat] = useState('classic');

  const fmt = FORMAT_PRESETS[format];

  useEffect(() => {
    if (!isOpen || !car) return;
    const photos = car.photos || car.images || [];
    const first = photos[0];
    let url = null;
    if (typeof first === 'string') url = first;
    else if (first?.url) url = first.url;
    else if (first?.data) url = first.data;
    setPhotoUrl(url);
  }, [isOpen, car]);

  const generateImage = async () => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0b0b0c',
        scale: 3, // ✅ Yüksek çözünürlük (yaklaşık 1080×1458)
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      // ✅ PNG → kayıpsız, WhatsApp galeride canlı görsel olarak gözükür
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Image generation error:', e);
      return null;
    }
  };

  // Wrapper that owns the loading state
  const runWithLoader = async (fn) => {
    setGenerating(true);
    try {
      return await fn();
    } finally {
      setGenerating(false);
    }
  };

  const dataUrlToFile = async (dataUrl, filename) => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  // ✅ PDF dosya adı: önce plaka, yoksa marka/model
  const getFileSafeName = () => {
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]+/g, '_').replace(/^_+|_+$/g, '');
    if (car.plate) return safe(car.plate.toUpperCase());
    const brandModel = [car.brand, car.model, car.year].filter(Boolean).join('-');
    return safe(brandModel) || 'arac';
  };

  const handleDownload = () => runWithLoader(async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return toast.error('Görsel oluşturulamadı');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${getFileSafeName()}-paylasim.png`;
    a.click();
  });

  // ✅ PDF: A4 sayfa içine kart görseli yerleştirilir
  //   - Dosya adı = plaka veya marka_model_yıl
  //   - Müşterinin görmemesi gereken bilgiler (alış fiyatı, giderler) KARTTA ZATEN YOK
  //   - Tek sayfa, kart ortalanmış, üstte galeri başlığı ile birlikte
  const handleDownloadPDF = () => runWithLoader(async () => {
    if (!cardRef.current) return toast.error('Kart hazır değil');
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0b0b0c',
        scale: 3,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      // A4 dikey: 210×297 mm
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;
      const margin = 12;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;

      // Kart aspect ratio'sunu koruyarak ortala
      const ratio = canvas.width / canvas.height;
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;

      // Arka plan (premium dark sayfa)
      pdf.setFillColor(11, 11, 12);
      pdf.rect(0, 0, pageW, pageH, 'F');

      // Üst bilgi şeridi
      const companyName = (user?.company_name || 'Oto-Cari Otomotiv').toUpperCase();
      pdf.setTextColor(197, 162, 103); // gold
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(companyName, pageW / 2, 9, { align: 'center' });

      // Kart görseli
      pdf.addImage(imgData, 'JPEG', x, y, w, h, undefined, 'FAST');

      // Alt iletişim şeridi
      const contact = [user?.phone, user?.email].filter(Boolean).join('  ·  ');
      pdf.setTextColor(180, 180, 180);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      if (contact) pdf.text(contact, pageW / 2, pageH - 8, { align: 'center' });
      pdf.setTextColor(140, 140, 140);
      pdf.setFontSize(7);
      pdf.text('Powered by MacTech', pageW / 2, pageH - 4, { align: 'center' });

      pdf.save(`${getFileSafeName()}.pdf`);
      toast.success('PDF indirildi');
    } catch (e) {
      console.error('PDF generation error:', e);
      toast.error('PDF oluşturulamadı');
    }
  });

  // ✅ PDF dosyasını blob olarak oluştur (paylaşım için)
  const buildPdfBlob = async () => {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#0b0b0c',
      scale: 3,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 12;
    const availW = pageW - margin * 2, availH = pageH - margin * 2;
    const ratio = canvas.width / canvas.height;
    let w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    const x = (pageW - w) / 2, y = (pageH - h) / 2;
    pdf.setFillColor(11, 11, 12);
    pdf.rect(0, 0, pageW, pageH, 'F');
    const companyName = (user?.company_name || 'Oto-Cari Otomotiv').toUpperCase();
    pdf.setTextColor(197, 162, 103);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(companyName, pageW / 2, 9, { align: 'center' });
    pdf.addImage(imgData, 'JPEG', x, y, w, h, undefined, 'FAST');
    const contact = [user?.phone, user?.email].filter(Boolean).join('  ·  ');
    pdf.setTextColor(180, 180, 180);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    if (contact) pdf.text(contact, pageW / 2, pageH - 8, { align: 'center' });
    pdf.setTextColor(140, 140, 140);
    pdf.setFontSize(7);
    pdf.text('Powered by MacTech', pageW / 2, pageH - 4, { align: 'center' });
    return pdf.output('blob');
  };

  // ✅ Sade metin — emoji yerine basit etiketler (WhatsApp/Telegram'da temiz görünür)
  const buildText = () => {
    const items = [
      `${(car.brand || '')} ${(car.model || '')} ${(car.year || '')}`.trim(),
      car.package_info ? `Paket: ${car.package_info}` : null,
      car.engine_type ? `Motor: ${car.engine_type}` : null,
      car.gear ? `Vites: ${car.gear}` : null,
      car.fuel_type ? `Yakıt: ${car.fuel_type}` : null,
      typeof car.km !== 'undefined' && car.km !== null ? `KM: ${Number(car.km).toLocaleString('tr-TR')}` : null,
      car.color ? `Renk: ${car.color}` : null,
      car.sale_price ? `Fiyat: ${formatCurrency(car.sale_price)}` : null,
    ].filter(Boolean);
    const head = `*${(car.brand || '')} ${(car.model || '')}*${car.year ? ` (${car.year})` : ''}`;
    const body = items.slice(1).map(s => `• ${s}`).join('\n');
    const foot = [
      '',
      `_${user?.company_name || 'MACTech Galeri'}_`,
      user?.phone ? user.phone : null,
    ].filter(Boolean).join('\n');
    return `${head}\n${body}${foot}`;
  };

  // ✅ Tek tık: native paylaşım (mobilde WhatsApp seçilince fotoğraf "galeri görseli" olarak iletilir,
  //    document/file olarak değil). Web Share API yoksa fallback indir + wa.me text.
  const handleSmartShare = () => runWithLoader(async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return toast.error('Görsel oluşturulamadı');

    const file = await dataUrlToFile(dataUrl, `${getFileSafeName()}.png`);
    const text = buildText();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${car.brand} ${car.model}`,
          text,
        });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // kullanıcı vazgeçti
        console.warn('Native share failed, fallback to download', e);
      }
    }
    // Fallback: indir + wa.me metnini aç
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${getFileSafeName()}-paylasim.png`;
    a.click();
    setTimeout(() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }, 600);
  });

  // ✅ PDF olarak paylaş (WhatsApp Document, e-posta vs.)
  const handleSharePDF = () => runWithLoader(async () => {
    try {
      const blob = await buildPdfBlob();
      if (!blob) return toast.error('PDF oluşturulamadı');
      const filename = `${getFileSafeName()}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${car.brand} ${car.model}`,
            text: buildText(),
          });
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      // Fallback: indir + WhatsApp web aç
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank');
      }, 600);
    } catch (e) {
      console.error(e);
      toast.error('PDF paylaşılamadı');
    }
  });

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      toast.success('Metin kopyalandı');
    } catch (_) {
      toast.error('Kopyalanamadı');
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
          <DialogDescription className="sr-only">
            Aracın görselini sosyal medya formatında oluşturun, AI ile dramatik render edin ve paylaşın.
          </DialogDescription>
        </DialogHeader>

        {/* ✅ Format Seçici — Klasik / Story / Kare */}
        <div className="flex items-center gap-1.5 flex-wrap pb-1" data-testid="share-format-row">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Format:</span>
          {Object.values(FORMAT_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFormat(p.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                format === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`share-format-${p.id}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Card preview - dinamik aspect ratio */}
        <div className="my-3 overflow-hidden rounded-xl border border-border flex justify-center">
          <div
            ref={cardRef}
            className="relative w-full bg-[#0b0b0c] text-white"
            style={{ aspectRatio: fmt.ratio, maxWidth: fmt.maxWidth, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
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
              {/* Üst altın şerit + galerinizin adı */}
              <div className="absolute inset-x-0 top-0 px-4 py-2.5 bg-gradient-to-b from-black/85 to-transparent flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  {user?.company_name || 'MACTech Galeri'}
                </div>
                {car.plate && (
                  <div className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-extrabold tracking-wider">
                    {(car.plate || '').toUpperCase()}
                  </div>
                )}
              </div>
              {/* Alt yumuşak gradyan (başlığa geçiş) */}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0b0b0c] to-transparent" />
            </div>

            {/* Başlık + özellikler */}
            <div className="px-5 pt-4 pb-5 space-y-3">
              <div>
                <div className="text-2xl sm:text-[26px] font-extrabold leading-tight tracking-tight">
                  {car.brand} {car.model}
                </div>
                <div className="mt-0.5 text-xs text-white/70">
                  {[car.year, car.package_info].filter(Boolean).join('  ·  ')}
                </div>
              </div>

              {/* Özellik grid'i — emoji yerine etiket+değer satırları */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {car.km !== undefined && car.km !== null && (
                  <Spec label="KM" value={`${Number(car.km).toLocaleString('tr-TR')}`} />
                )}
                {car.fuel_type && <Spec label="Yakıt" value={car.fuel_type} />}
                {car.gear && <Spec label="Vites" value={car.gear} />}
                {car.engine_type && <Spec label="Motor" value={car.engine_type} />}
                {car.color && <Spec label="Renk" value={car.color} />}
                {car.year && <Spec label="Model Yılı" value={String(car.year)} />}
              </div>

              {/* Ekspertiz Şeması — Otomologs tarzı diyagram */}
              {(car.expertise_parts || car.expertiseParts) && (
                <div
                  className="rounded-lg overflow-hidden border border-white/10 bg-black"
                  dangerouslySetInnerHTML={{
                    __html: buildSedanDiagramSvg(
                      { parts: car.expertise_parts || car.expertiseParts || {} },
                      { includeLegend: true, includeSummaryList: false, withWrapper: true, darkBg: true, maxWidth: 360 }
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

              {/* Alt iletişim şeridi */}
              {(user?.phone || user?.email) && (
                <div className="text-[10px] text-white/55 text-center pt-1">
                  {[user?.phone, user?.email].filter(Boolean).join('  ·  ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleSharePDF}
            disabled={generating}
            className="w-full h-12 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            data-testid="share-card-pdf-share-btn"
          >
            <FileText size={18} />
            {generating ? 'Hazırlanıyor...' : 'PDF Olarak Paylaş (Tavsiye)'}
          </button>
          <button
            type="button"
            onClick={handleSmartShare}
            disabled={generating}
            className="w-full h-11 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors text-sm"
            data-testid="share-card-smart-btn"
          >
            <Share2 size={16} />
            {generating ? 'Hazırlanıyor...' : 'Görsel Olarak Paylaş'}
          </button>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            <b>PDF</b>: Kurumsal kart formatında belge — galeri logosu, fotoğraf ve müşteri görmeye yetkili tüm detaylar.<br />
            <b>Görsel</b>: WhatsApp&apos;ta galeri fotoğrafı gibi anında görünür.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={generating}
              className="h-11 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors text-rose-400"
              data-testid="share-card-download-pdf-btn"
            >
              <Download size={14} />
              PDF
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={generating}
              className="h-11 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              data-testid="share-card-download-btn"
            >
              <Download size={14} />
              PNG
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="h-11 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              data-testid="share-card-copy-text-btn"
            >
              <MessageCircle size={14} />
              Metin
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

// Mini özellik satırı — sade etiket + değer
const Spec = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
    <span className="text-[10px] uppercase tracking-wider text-white/55 font-medium">{label}</span>
    <span className="font-semibold text-white/95 truncate text-right">{value}</span>
  </div>
);

export default ShareCardModal;

// ✅ Tanıtım kartı için kompakt hasar durumu şeridi (deprecated — yerine sedanDiagram kullanılıyor)
