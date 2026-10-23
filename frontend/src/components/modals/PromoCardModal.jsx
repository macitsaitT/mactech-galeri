import React, { useState } from 'react';
import { FileText, Download, Phone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/helpers';
import { fileAPI } from '../../services/api';
import { buildSedanDiagramSvg } from './promoParts/sedanDiagram';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath;
  return fileAPI.getUrl(logoPath);
};

// ✅ Profesyonel "Otomologs tarzı" hasar diyagramı — promoParts/sedanDiagram.js
const TopDownDiagram = ({ expertise }) => {
  const svgString = buildSedanDiagramSvg(expertise, {
    includeLegend: true,
    includeSummaryList: true,
    withWrapper: true,
    darkBg: true,
    maxWidth: 360,
  });
  return (
    <div
      className="w-full flex items-center justify-center bg-black rounded-lg overflow-hidden border border-zinc-800"
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};

const PromoCardModal = ({ isOpen, onClose }) => {
  const { user, cars, orgOwner } = useApp();
  const activeCars = cars.filter(c => !c.deleted && c.status !== 'Satıldı');
  const [selectedCarId, setSelectedCarId] = useState('');
  const selectedCar = activeCars.find(c => c.id === selectedCarId);

  // Always use org owner (admin/galeri sahibi) info
  const companyName = orgOwner?.company_name || user?.company_name || '';
  const companyPhone = orgOwner?.phone || user?.phone || '';
  const logoPath = orgOwner?.logo_url || user?.logo_url || '';

  const fetchLogoAsDataUrl = () => {
    return new Promise((resolve) => {
      const url = getLogoUrl(logoPath);
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const handleDownloadPDF = async () => {
    if (!selectedCar) return;
    const logoDataUrl = await fetchLogoAsDataUrl();
    const mechMotor = selectedCar.expertise?.mechanical?.motor || 'Orijinal';
    const mechSanziman = selectedCar.expertise?.mechanical?.sanziman || 'Orijinal';
    const mechYuruyen = selectedCar.expertise?.mechanical?.yuruyen || 'Orijinal';

    const buildSvg = () => buildSedanDiagramSvg(selectedCar.expertise, {
      includeLegend: true,
      includeSummaryList: true,
      withWrapper: true,
      darkBg: false,
      maxWidth: 260,
    });

    const watermarkCSS = logoDataUrl ? `.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.06;z-index:0;pointer-events:none;}.watermark img{width:350px;height:auto;}` : '';
    const watermarkHTML = logoDataUrl ? `<div class="watermark"><img src="${logoDataUrl}"/></div>` : '';
    const logoHeader = logoDataUrl ? `<img src="${logoDataUrl}" style="height:36px;width:auto;margin-left:10px;vertical-align:middle;border-radius:4px;"/>` : '';

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tanitim Karti - ${selectedCar.plate}</title>
<style>
@page{margin:10mm;size:A4;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Arial,sans-serif;color:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
${watermarkCSS}
.card{position:relative;z-index:1;max-width:560px;margin:0 auto;border:1.5px solid #ddd;border-radius:8px;overflow:hidden;background:#fff;}
.header{background:#111;color:#fff;padding:20px 24px;text-align:center;}
.header h1{font-size:20px;font-weight:800;letter-spacing:1px;display:inline;vertical-align:middle;}
.header .sub{color:#d4a030;font-size:11px;letter-spacing:3px;margin-top:5px;}
.gold{background:#d4a030;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;}
.gold h2{font-size:26px;font-weight:800;margin:0;}
.gold .mdl{font-size:16px;font-weight:700;margin-top:2px;}
.gold .yr{font-size:14px;color:#333;}
.gold .pr-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;text-align:right;}
.gold .pr-val{font-size:26px;font-weight:800;text-align:right;}
.specs{display:flex;background:#f5f5f5;border-bottom:1px solid #ddd;}
.spec{flex:1;text-align:center;padding:10px 6px;border-right:1px solid #ddd;}
.spec:last-child{border-right:none;}
.spec .lbl{font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:4px;}
.spec .val{font-size:13px;font-weight:700;}
.body-row{display:flex;min-height:260px;}
.body-left{flex:1;padding:20px 24px;border-right:1px solid #ddd;}
.body-right{width:240px;padding:16px;display:flex;flex-direction:column;align-items:center;}
.section-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;font-weight:600;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #eee;}
.desc{font-size:12px;color:#555;line-height:1.6;margin-bottom:16px;}
.mech .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:12px;}
.mech .row .l{color:#666;}
.mech .row .v{font-weight:600;}
.footer{background:#f5f5f5;padding:14px;text-align:center;border-top:1px solid #ddd;}
.footer .ft{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;}
.footer .ph{font-size:18px;font-weight:700;}
</style></head><body>
${watermarkHTML}
<div class="card">
  <div class="header">
    <h1>${companyName} ${logoHeader}</h1>
    <div class="sub">GALERi SAHiBi</div>
  </div>
  <div class="gold">
    <div><h2>${selectedCar.brand?.toUpperCase()}</h2><div class="mdl">${selectedCar.model?.toUpperCase()} ${selectedCar.vehicle_type?.toUpperCase() || ''}</div><div class="yr">${selectedCar.year}</div></div>
    <div><div class="pr-label">Fiyat</div><div class="pr-val">${formatCurrency(selectedCar.sale_price)}</div></div>
  </div>
  <div class="specs">
    <div class="spec"><div class="lbl">Kilometre</div><div class="val">${selectedCar.km || '0'} KM</div></div>
    <div class="spec"><div class="lbl">Yakit</div><div class="val">${selectedCar.fuel_type || '-'}</div></div>
    <div class="spec"><div class="lbl">Vites</div><div class="val">${selectedCar.gear || '-'}</div></div>
    <div class="spec"><div class="lbl">Kasa Tipi</div><div class="val">${selectedCar.vehicle_type || '-'}</div></div>
    <div class="spec"><div class="lbl">Muayene</div><div class="val">${selectedCar.inspection_date ? new Date(selectedCar.inspection_date).toLocaleDateString('tr-TR', { month: '2-digit', year: '2-digit' }) : '-'}</div></div>
  </div>
  <div class="body-row">
    <div class="body-left">
      <div class="section-title">Arac Aciklamasi</div>
      <p class="desc">${selectedCar.description || 'Arac hakkinda detayli bilgi icin lutfen satis temsilcimiz ile iletisime geciniz. Araclarimiz ekspertiz garantilidir.'}</p>
      <div class="section-title">Mekanik Durum</div>
      <div class="mech">
        <div class="row"><span class="l">MOTOR DURUMU</span><span class="v">${mechMotor}</span></div>
        <div class="row"><span class="l">SANZIMAN DURUMU</span><span class="v">${mechSanziman}</span></div>
        <div class="row"><span class="l">YURUYEN DURUMU</span><span class="v">${mechYuruyen}</span></div>
      </div>
    </div>
    <div class="body-right">
      <div class="section-title" style="width:100%">Kaporta Durum Ozeti</div>
      ${buildSvg()}
    </div>
  </div>
  <div class="footer"><div class="ft">Iletisim</div><div class="ph">${companyPhone}</div></div>
</div></body></html>`);
    w.document.close();
    w.onload = () => w.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" data-testid="promo-card-modal">
        <DialogHeader className="flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pr-10">
          <DialogTitle className="flex items-center gap-2">
            <FileText size={22} className="text-primary" />
            Tanıtım Kartı
          </DialogTitle>
          <button
            onClick={handleDownloadPDF}
            disabled={!selectedCar}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40"
            data-testid="download-promo-pdf-btn"
          >
            <Download size={16} />
            PDF İndir
          </button>
        </DialogHeader>

        {/* Car selector */}
        <div className="py-3 border-b border-border">
          <label className="block text-[11px] font-semibold text-muted-foreground tracking-wider uppercase mb-1.5">Araç Seçin</label>
          <select
            value={selectedCarId}
            onChange={(e) => setSelectedCarId(e.target.value)}
            className="w-full h-11 px-4 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
            data-testid="promo-car-select"
          >
            <option value="">Araç seçiniz...</option>
            {activeCars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.plate?.toUpperCase()} - {car.brand} {car.model} {car.vehicle_type} ({car.year})
              </option>
            ))}
          </select>
        </div>

        {/* Card Preview */}
        <div className="flex-1 overflow-y-auto py-4">
          {selectedCar ? (
            <div className="rounded-lg overflow-hidden border border-border shadow-lg max-w-xl mx-auto bg-white text-black">
              {/* Black header */}
              <div className="bg-[#111] text-white py-5 px-6 text-center">
                <div className="flex items-center justify-center gap-3">
                  <h1 className="text-xl font-extrabold tracking-wider">{companyName}</h1>
                  {logoPath && <img src={getLogoUrl(logoPath)} alt="" className="h-9 w-auto object-contain" crossOrigin="anonymous" />}
                </div>
                <p className="text-amber-400 text-[11px] tracking-[3px] mt-1">GALERİ SAHİBİ</p>
              </div>

              {/* Gold info band */}
              <div className="bg-amber-400 py-4 sm:py-5 px-4 sm:px-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-[26px] font-extrabold leading-tight text-black">{selectedCar.brand?.toUpperCase()}</h2>
                  <p className="text-sm sm:text-base font-bold text-black">{selectedCar.model?.toUpperCase()} {selectedCar.vehicle_type?.toUpperCase()}</p>
                  <p className="text-sm text-black/70">{selectedCar.year}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-black/60">Fiyat</p>
                  <p className="text-xl sm:text-[26px] font-extrabold text-black">{formatCurrency(selectedCar.sale_price)}</p>
                </div>
              </div>

              {/* Specs row */}
              <div className="grid grid-cols-3 sm:flex bg-[#f5f5f5] border-b border-[#ddd]">
                {[
                  { label: 'Kilometre', value: `${selectedCar.km || '0'} KM` },
                  { label: 'Yakıt', value: selectedCar.fuel_type || '-' },
                  { label: 'Vites', value: selectedCar.gear || '-' },
                  { label: 'Kasa Tipi', value: selectedCar.vehicle_type || '-' },
                  { label: 'Muayene', value: selectedCar.inspection_date ? new Date(selectedCar.inspection_date).toLocaleDateString('tr-TR', { month: '2-digit', year: '2-digit' }) : '-' },
                ].map((spec, i) => (
                  <div key={i} className={`sm:flex-1 text-center py-2.5 sm:py-3 px-1.5 sm:px-2 border-b sm:border-b-0 border-[#ddd] ${i < 4 ? 'sm:border-r' : ''}`}>
                    <p className="text-[8px] sm:text-[9px] uppercase tracking-wider text-gray-500 mb-0.5 sm:mb-1">{spec.label}</p>
                    <p className="text-[11px] sm:text-[13px] font-bold text-black">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Two-column body */}
              <div className="flex flex-col sm:flex-row sm:min-h-[280px]">
                {/* Left: Description + Mechanical */}
                <div className="flex-1 p-4 sm:p-5 sm:border-r border-b sm:border-b-0 border-[#ddd]">
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 pb-1 border-b border-[#eee]">Araç Açıklaması</h4>
                  <p className="text-[12px] text-gray-600 leading-relaxed mb-5">
                    {selectedCar.description || 'Araç hakkında detaylı bilgi için lütfen satış temsilcimiz ile iletişime geçiniz. Araçlarımız ekspertiz garantilidir.'}
                  </p>
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 pb-1 border-b border-[#eee]">Mekanik Durum</h4>
                  <div className="space-y-0">
                    {[
                      { label: 'MOTOR DURUMU', value: selectedCar.expertise?.mechanical?.motor || 'Orijinal' },
                      { label: 'ŞANZIMAN DURUMU', value: selectedCar.expertise?.mechanical?.sanziman || 'Orijinal' },
                      { label: 'YÜRÜYEN DURUMU', value: selectedCar.expertise?.mechanical?.yuruyen || 'Orijinal' },
                    ].map((m, i) => (
                      <div key={i} className="flex justify-between py-1.5 border-b border-[#f0f0f0] text-[12px]">
                        <span className="text-gray-500">{m.label}</span>
                        <span className="font-semibold text-black">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Body Diagram */}
                <div className="w-full sm:w-[260px] p-4 flex flex-col items-center">
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3 pb-1 border-b border-[#eee] w-full">Kaporta Durum Özeti</h4>
                  <TopDownDiagram expertise={selectedCar.expertise} />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#f5f5f5] py-4 px-6 text-center border-t border-[#ddd]">
                <p className="text-[10px] uppercase tracking-[2px] text-gray-500 mb-1">İletişim</p>
                <p className="text-lg font-bold text-black flex items-center justify-center gap-2">
                  <Phone size={18} className="text-amber-500" />{companyPhone}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Tanıtım kartı oluşturmak için bir araç seçin</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromoCardModal;
