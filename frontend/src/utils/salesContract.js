// Noter formatında "İKİNCİ EL ARAÇ SATIŞ SÖZLEŞMESİ" HTML üretici.
// Yazdırıldığında A4 format, imza alanları ve resmî dil içerir.

import { formatCurrency, formatDate } from './helpers';

// Sayıyı Türkçe yazıya çevir (0 - 999.999.999 aralığı yeterli).
const _birler = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
const _onlar = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
const _yuzler = ['', 'Yüz', 'İkiYüz', 'ÜçYüz', 'DörtYüz', 'BeşYüz', 'AltıYüz', 'YediYüz', 'SekizYüz', 'DokuzYüz'];

const _uclu = (n) => {
  if (n === 0) return '';
  const y = Math.floor(n / 100);
  const o = Math.floor((n % 100) / 10);
  const b = n % 10;
  let s = _yuzler[y] + _onlar[o] + _birler[b];
  if (y === 1) s = 'Yüz' + _onlar[o] + _birler[b];
  return s;
};

export const numberToTurkishWords = (num) => {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Sıfır';
  const milyar = Math.floor(n / 1000000000);
  const milyon = Math.floor((n % 1000000000) / 1000000);
  const bin = Math.floor((n % 1000000) / 1000);
  const kalan = n % 1000;
  let s = '';
  if (milyar) s += _uclu(milyar) + 'Milyar';
  if (milyon) s += _uclu(milyon) + 'Milyon';
  if (bin) s += (bin === 1 ? '' : _uclu(bin)) + 'Bin';
  if (kalan) s += _uclu(kalan);
  return s + 'TL';
};

export const buildSalesContractHTML = ({ car, customer, salePrice, saleDate, company }) => {
  const today = saleDate ? formatDate(saleDate) : formatDate(new Date().toISOString());
  const plate = (car?.plate || '').toUpperCase();
  const brand = car?.brand || '';
  const model = car?.model || '';
  const year = car?.year || '';
  const km = car?.km ? String(car.km) : '';
  const chassis = car?.chassis_no || car?.vin || '';
  const engineNo = car?.engine_no || '';
  const color = car?.color || '';
  const fuel = car?.fuel_type || '';
  const gear = car?.gear || '';

  const customerName = customer?.name || '________________________________';
  const customerPhone = customer?.phone || '________________';
  const customerTC = customer?.tc_number || customer?.identity_no || '___________________';
  const customerAddress = customer?.address || '________________________________________________';

  const companyName = company?.company_name || 'MACTech Oto Galeri';
  const companyPhone = company?.phone || '________________';
  const companyAddress = company?.address || '________________________________________________';
  const companyTax = company?.tax_no || company?.tax_number || '___________________';

  const priceFmt = formatCurrency(salePrice);
  const priceWords = numberToTurkishWords(salePrice);

  const logoDataUrl = company?.logoDataUrl || null;
  const logoHTML = logoDataUrl
    ? `<img src="${logoDataUrl}" style="height:60px;width:auto;object-fit:contain;" />`
    : `<div style="font-size:18px;font-weight:800;letter-spacing:0.5px;">${companyName}</div>`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>2. El Araç Satış Sözleşmesi - ${plate}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Georgia, serif; margin: 0; padding: 0; color: #111; font-size: 12.5px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #111; margin-bottom: 18px; }
    .header .right { text-align: right; font-size: 11px; color: #333; }
    h1.title { text-align: center; font-size: 18px; margin: 14px 0 4px; letter-spacing: 1px; text-transform: uppercase; }
    .subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 18px; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: #f1f1f1; padding: 6px 10px; border-left: 4px solid #111; margin-bottom: 8px; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv td { padding: 5px 8px; border-bottom: 1px solid #e4e4e4; vertical-align: top; }
    table.kv td.label { font-weight: 600; width: 30%; color: #333; }
    table.kv td.value { color: #111; }
    .price-box { margin: 12px 0; padding: 12px 14px; border: 2px solid #111; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
    .price-box .price { font-size: 22px; font-weight: 800; }
    .price-box .words { font-size: 11px; color: #444; font-style: italic; max-width: 60%; text-align: right; }
    ol.terms { padding-left: 20px; margin: 6px 0; }
    ol.terms li { margin-bottom: 6px; text-align: justify; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; gap: 30px; }
    .sig { flex: 1; text-align: center; }
    .sig .role { font-weight: 700; font-size: 12px; margin-bottom: 60px; }
    .sig .line { border-top: 1.5px solid #111; padding-top: 6px; font-size: 11px; color: #444; }
    .footer-note { margin-top: 22px; font-size: 10.5px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>${logoHTML}</div>
    <div class="right">
      <div><strong>${companyName}</strong></div>
      <div>Tel: ${companyPhone}</div>
      ${companyAddress && companyAddress.trim() ? `<div>${companyAddress}</div>` : ''}
      ${companyTax && !companyTax.startsWith('___') ? `<div>V.D./V.No: ${companyTax}</div>` : ''}
    </div>
  </div>

  <h1 class="title">2. El Araç Satış Sözleşmesi</h1>
  <div class="subtitle">Düzenleme Tarihi: ${today}</div>

  <div class="section">
    <div class="section-title">Satıcı</div>
    <table class="kv">
      <tr><td class="label">Unvan</td><td class="value">${companyName}</td></tr>
      <tr><td class="label">Adres</td><td class="value">${companyAddress}</td></tr>
      <tr><td class="label">Telefon</td><td class="value">${companyPhone}</td></tr>
      <tr><td class="label">V.D. / V.No</td><td class="value">${companyTax}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Alıcı</div>
    <table class="kv">
      <tr><td class="label">Ad Soyad</td><td class="value">${customerName}</td></tr>
      <tr><td class="label">T.C. Kimlik No</td><td class="value">${customerTC}</td></tr>
      <tr><td class="label">Telefon</td><td class="value">${customerPhone}</td></tr>
      <tr><td class="label">Adres</td><td class="value">${customerAddress}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Araç Bilgileri</div>
    <table class="kv">
      <tr><td class="label">Plaka</td><td class="value">${plate || '________________'}</td><td class="label">Marka / Model</td><td class="value">${brand} ${model}</td></tr>
      <tr><td class="label">Model Yılı</td><td class="value">${year || '________'}</td><td class="label">Kilometre</td><td class="value">${km || '________'}</td></tr>
      <tr><td class="label">Şasi No</td><td class="value">${chassis || '________________________'}</td><td class="label">Motor No</td><td class="value">${engineNo || '________________'}</td></tr>
      <tr><td class="label">Renk</td><td class="value">${color || '__________'}</td><td class="label">Yakıt / Vites</td><td class="value">${fuel || '____'} / ${gear || '____'}</td></tr>
    </table>
  </div>

  <div class="price-box">
    <div class="price">${priceFmt}</div>
    <div class="words">Yalnız: ${priceWords}</div>
  </div>

  <div class="section">
    <div class="section-title">Sözleşme Hükümleri</div>
    <ol class="terms">
      <li>Satıcı, yukarıda bilgileri belirtilen aracın zilyetliğini ve mülkiyet devrine ilişkin tüm belgelerini, işbu sözleşme imza tarihinde Alıcı'ya teslim etmiştir.</li>
      <li>Alıcı, işbu sözleşmede belirtilen satış bedelinin tamamını Satıcı'ya peşinen ve nakden / havale ile ödemiş olup Satıcı bedeli eksiksiz tahsil etmiştir.</li>
      <li>Alıcı, aracın ${today} tarihi itibarıyla teknik, mekanik, kaporta ve elektronik aksamını, kilometresini, kaza/hasar geçmişini, ekspertiz raporunu inceleyerek aracı mevcut durumuyla (as-is) satın almayı kabul ve beyan eder.</li>
      <li>Trafik tescili işlemleri ${today} tarihi itibarıyla tarafların anlaşması dâhilinde gerçekleştirilecek; bu tarihe kadar her türlü trafik cezası, vergi ve sigorta sorumluluğu Satıcı'ya, bu tarihten sonrası Alıcı'ya aittir.</li>
      <li>İşbu sözleşmeden doğabilecek ihtilaflarda Türkiye Cumhuriyeti kanunları uygulanır; ${company?.court || 'ilgili'} Mahkemeleri ve İcra Daireleri yetkilidir.</li>
      <li>İşbu sözleşme iki nüsha olarak düzenlenmiş, taraflarca imzalanarak birer nüshası tarafların kendilerinde kalmıştır.</li>
    </ol>
  </div>

  <div class="signatures">
    <div class="sig">
      <div class="role">SATICI</div>
      <div class="line">${companyName}<br/>İmza / Kaşe</div>
    </div>
    <div class="sig">
      <div class="role">ALICI</div>
      <div class="line">${customerName}<br/>İmza</div>
    </div>
  </div>

  <div class="footer-note">Bu belge ${companyName} tarafından düzenlenmiştir. Noter tasdiki / trafik tescili sonrasında mülkiyet devri resmîleşir.</div>
</body>
</html>`;
};
