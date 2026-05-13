import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, MessageCircle, X, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { formatCurrency } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { statusConfig, carParts } from '../CarExpertiseDiagram';
import { aiRenderAPI } from '../../services/api';
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

// ✅ AI Render stilleri — backend STYLE_PRESETS ile eşleşir.
const AI_STYLES = [
  { id: 'studio_dark',       label: 'Stüdyo (Koyu)' },
  { id: 'dramatic_lighting', label: 'Dramatik Işık' },
  { id: 'billboard',         label: 'Billboard' },
  { id: 'showroom',          label: 'Showroom' },
];

/**
 * WhatsApp Paylaşım Kartı - araç fotoğrafı + temel özelliklerden zarif bir görsel kart üretir.
 * - "Görseli İndir" → PNG indirir.
 * - "Paylaş" → native Web Share API (mobil) ile sosyal medyaya iletilir.
 * - "AI ile Render Et" → araç fotosunu Nano Banana ile dramatik render eder (background replace).
 */
const ShareCardModal = ({ isOpen, onClose, car }) => {
  const cardRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const { user } = useApp();
  const [photoUrl, setPhotoUrl] = useState(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState(null);
  const [format, setFormat] = useState('classic');
  const [aiStyle, setAiStyle] = useState('studio_dark');
  const [aiLoading, setAiLoading] = useState(false);

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
    setOriginalPhotoUrl(url);
  }, [isOpen, car]);

  const generateImage = async () => {
    if (!cardRef.current) return null;
    setGenerating(true);
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
    } finally {
      setGenerating(false);
    }
  };

  const dataUrlToFile = async (dataUrl, filename) => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return toast.error('Görsel oluşturulamadı');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(car.plate || car.id || 'arac').toString().replace(/\s+/g, '_')}-paylasim.png`;
    a.click();
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
  const handleSmartShare = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return toast.error('Görsel oluşturulamadı');

    const file = await dataUrlToFile(dataUrl, `${(car.plate || 'arac').toString().replace(/\s+/g, '_')}.png`);
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
    a.download = `${(car.plate || 'arac').toString().replace(/\s+/g, '_')}-paylasim.png`;
    a.click();
    setTimeout(() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }, 600);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      toast.success('Metin kopyalandı');
    } catch (_) {
      toast.error('Kopyalanamadı');
    }
  };

  // ✅ AI Render — araç fotosunu Nano Banana ile yeniden render et (image-to-image)
  const handleAIRender = async () => {
    if (!originalPhotoUrl) {
      toast.error('Araç fotoğrafı yok — önce araca foto ekleyin');
      return;
    }
    setAiLoading(true);
    const toastId = toast.loading('AI render üretiliyor (~30-60 saniye)…');
    try {
      // dataURL veya http URL → File
      const blob = await (await fetch(originalPhotoUrl)).blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const file = new File([blob], `car.${ext}`, { type: blob.type || 'image/jpeg' });

      const { data } = await aiRenderAPI.renderCar(file, aiStyle);
      const mime = data?.mime_type || 'image/png';
      const dataUrl = `data:${mime};base64,${data.image_base64}`;
      setPhotoUrl(dataUrl);
      toast.success('AI render hazır — kartı kontrol edin', { id: toastId });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'AI render başarısız';
      toast.error(msg, { id: toastId });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIRevert = () => {
    if (originalPhotoUrl) {
      setPhotoUrl(originalPhotoUrl);
      toast.success('Orijinal foto geri yüklendi');
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

        {/* ✅ AI Render Kontrolleri */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2" data-testid="ai-render-panel">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles size={14} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary">AI ile arka plan render et</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {AI_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setAiStyle(s.id)}
                disabled={aiLoading}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors disabled:opacity-50 ${
                  aiStyle === s.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/60 text-muted-foreground hover:bg-muted'
                }`}
                data-testid={`ai-style-${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAIRender}
              disabled={aiLoading || !originalPhotoUrl}
              className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              data-testid="ai-render-btn"
            >
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {aiLoading ? 'Render ediliyor…' : 'Render Et'}
            </button>
            {photoUrl !== originalPhotoUrl && originalPhotoUrl && (
              <button
                type="button"
                onClick={handleAIRevert}
                disabled={aiLoading}
                className="h-9 px-2.5 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50 transition-colors"
                data-testid="ai-render-revert-btn"
                title="Orijinal fotoyu geri yükle"
              >
                Orijinal
              </button>
            )}
          </div>
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

              {/* Hasar Durumu özet şeridi */}
              <ExpertiseSummaryStrip parts={car.expertise_parts || car.expertiseParts || {}} />

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
            onClick={handleSmartShare}
            disabled={generating}
            className="w-full h-12 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            data-testid="share-card-smart-btn"
          >
            <Share2 size={18} />
            {generating ? 'Hazırlanıyor...' : "Paylaş (WhatsApp / Sosyal Medya)"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Paylaş'a basınca cihazınızın paylaşım menüsü açılır — WhatsApp seçince fotoğraf <b>galeri görseli</b> olarak gönderilir, dosya olarak değil.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={generating}
              className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              data-testid="share-card-download-btn"
            >
              <Download size={16} />
              Görseli İndir (PNG)
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="h-11 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              data-testid="share-card-copy-text-btn"
            >
              <MessageCircle size={16} />
              Metni Kopyala
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

// ✅ Tanıtım kartı için kompakt hasar durumu şeridi
const ExpertiseSummaryStrip = ({ parts }) => {
  const counts = { lokal: 0, boyali: 0, degisen: 0, orijinal: 0 };
  carParts.forEach(p => {
    const s = parts[p.id] || 'orijinal';
    counts[s] = (counts[s] || 0) + 1;
  });
  const totalIssue = counts.lokal + counts.boyali + counts.degisen;

  if (totalIssue === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] flex items-center justify-between text-emerald-300">
        <span className="font-semibold">EKSPERTİZ</span>
        <span>✓ Tüm parçalar orijinal</span>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="font-semibold tracking-wider text-white/80">EKSPERTİZ</span>
        <span className="text-white/60">{carParts.length - counts.orijinal}/{carParts.length} parça</span>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        {[
          ['lokal',   counts.lokal],
          ['boyali',  counts.boyali],
          ['degisen', counts.degisen],
        ].filter(([, n]) => n > 0).map(([k, n]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: statusConfig[k].bg }} />
            <span className="text-white/85">{statusConfig[k].name}: <b>{n}</b></span>
          </span>
        ))}
      </div>
    </div>
  );
};
